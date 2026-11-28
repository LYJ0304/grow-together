import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
page.setDefaultTimeout(8000);
await page.addInitScript(authenticatedSessionFixture);
let fail = true,
  reads = 0,
  writes = 0,
  name = '첫 보호자',
  childStatus = 404,
  release;
let held = new Promise((resolve) => {
  release = resolve;
});
await page.route('**/api/v1/users/me', async (r) => {
  const method = r.request().method();
  if (held) await held;
  if (method === 'PATCH') {
    writes++;
    name = r.request().postDataJSON().name;
  } else reads++;
  return r.fulfill(
    fail
      ? { status: 500, json: { code: 'INTERNAL_ERROR' } }
      : { json: { id: 1, name, email: 'one@example.com' } },
  );
});
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({
    status: childStatus,
    json: childStatus === 200 ? { name: '하늘', birthday: '2024-01-01' } : {},
  }),
);
const click = (name) => page.getByRole('button', { name, exact: true }).click();
const base = process.env.MOBILE_URL ?? 'http://localhost:8272';
try {
  await page.goto(base + '/mypage');
  await page.getByText('내 정보 확인 중', { exact: true }).waitFor();
  assert.equal(await page.getByText('첫 보호자', { exact: true }).count(), 0);
  const done = release;
  held = null;
  done();
  await page
    .getByRole('alert')
    .filter({ hasText: '내 정보를 불러오지 못했어요.' })
    .waitFor();
  fail = false;
  await click('내 정보 다시 불러오기');
  await page.getByText('첫 보호자', { exact: true }).waitFor();
  await page.getByText('아이 정보를 등록해주세요.', { exact: true }).waitFor();
  childStatus = 500;
  await page.reload();
  await click('아이 정보 다시 불러오기');
  childStatus = 200;
  await click('아이 정보 다시 불러오기');
  await page.getByText('하늘 · 2024년 1월 1일', { exact: true }).waitFor();
  for (const width of [320, 375, 390, 1024]) {
    await page.setViewportSize({ width, height: 720 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await click('내 프로필 수정');
  const input = page.getByRole('textbox', { name: '이름', exact: true });
  for (const value of ['  ', '가'.repeat(51)]) {
    await input.fill(value);
    assert(
      await page
        .getByRole('button', { name: '변경사항 저장', exact: true })
        .isDisabled(),
    );
  }
  assert.equal(writes, 0);
  await page.setViewportSize({ width: 320, height: 480 });
  const large = await page.addStyleTag({
    content:
      '[dir="auto"] {font-size:24px !important;line-height:34px !important;}',
  });
  const saveButton = page.getByRole('button', {
    name: '변경사항 저장',
    exact: true,
  });
  await saveButton.scrollIntoViewIfNeeded();
  const saveBox = await saveButton.boundingBox();
  assert(
    saveBox.y >= 0 && saveBox.y + saveBox.height <= 480,
    'large-text save remains reachable',
  );
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await large.evaluate((node) => node.remove());
  await page.setViewportSize({ width: 390, height: 844 });
  await input.fill('브라우저 뒤로 가기 전 초안');
  await page.evaluate(() => history.back());
  await page
    .getByRole('heading', { name: '변경사항을 버릴까요?', exact: true })
    .waitFor();
  await click('계속 수정');
  assert.equal(await input.inputValue(), '브라우저 뒤로 가기 전 초안');
  await click('이전 화면으로');
  await click('변경사항 버리기');
  await page.waitForURL('**/mypage');
  await click('내 프로필 수정');
  await input.fill('저장할 이름');
  held = new Promise((resolve) => {
    release = resolve;
  });
  await click('변경사항 저장');
  await page.getByRole('button', { name: '저장 중…', exact: true }).waitFor();
  assert(!(await input.isEditable()));
  assert(
    await page
      .getByRole('button', { name: '이전 화면으로', exact: true })
      .isDisabled(),
  );
  await page
    .getByRole('button', { name: '저장 중…', exact: true })
    .evaluate((node) => node.click());
  const finish = release;
  held = null;
  finish();
  await page.waitForURL('**/mypage');
  assert.equal(writes, 1);
  assert(reads >= 2);
  await mkdir('/tmp/guardian-shots', { recursive: true });
  await page.screenshot({
    path: '/tmp/guardian-shots/mypage.png',
    fullPage: true,
  });
  console.log(
    'PASS loading/error/retry vs absent child, validation, browser back/discard, duplicate-save blocking, responsive profile, authenticated profile',
  );
} catch (error) {
  console.log((await page.locator('body').innerText()).slice(-1800));
  throw error;
} finally {
  await browser.close();
}
