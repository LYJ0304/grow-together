import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(8000);
await page.addInitScript(authenticatedSessionFixture);
let name = '보호자',
  fail = false,
  writes = 0;
await page.route('**/api/v1/users/me', (r) => {
  if (r.request().method() === 'PATCH') {
    writes++;
    if (fail)
      return r.fulfill({ status: 400, json: { code: 'INVALID_REQUEST' } });
    name = r.request().postDataJSON().name;
  }
  return r.fulfill({ json: { id: 1, name, email: 'parent@example.com' } });
});
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2024-02-29' } }),
);
const click = (name) => page.getByRole('button', { name, exact: true }).click();
try {
  await page.goto(
    `${process.env.MOBILE_URL ?? 'http://localhost:8272'}/mypage`,
  );
  await page
    .getByRole('heading', { name: '마이페이지', exact: true })
    .waitFor();
  await page.getByText('parent@example.com', { exact: true }).waitFor();
  assert.equal(await page.getByRole('switch').count(), 0);
  await click('내 프로필 수정');
  const input = page.getByRole('textbox', { name: '이름', exact: true });
  assert.equal(await input.inputValue(), '보호자');
  assert(
    await page
      .getByRole('button', { name: '변경사항 저장', exact: true })
      .isDisabled(),
  );
  await input.fill('  새 이름  ');
  fail = true;
  await click('변경사항 저장');
  await page
    .getByRole('alert')
    .filter({ hasText: '입력 내용을 확인' })
    .waitFor();
  assert.equal(await input.inputValue(), '  새 이름  ');
  fail = false;
  await click('변경사항 저장');
  await page.waitForURL('**/mypage');
  await page.getByText('새 이름', { exact: true }).waitFor();
  assert.equal(writes, 2);
  assert.equal(name, '새 이름');
  await page.reload();
  await page.getByText('새 이름', { exact: true }).waitFor();
  await click('내 프로필 수정');
  await input.fill('미저장 이름');
  await click('이전 화면으로');
  await page
    .getByRole('heading', { name: '변경사항을 버릴까요?', exact: true })
    .waitFor();
  await click('계속 수정');
  assert.equal(await input.inputValue(), '미저장 이름');
  await click('이전 화면으로');
  await click('변경사항 버리기');
  await page.waitForURL('**/mypage');
  await page.getByText('새 이름', { exact: true }).waitFor();
  await mkdir('/tmp/guardian-shots', { recursive: true });
  await page.screenshot({
    path: '/tmp/guardian-shots/mypage-mobile.png',
    fullPage: true,
  });
  console.log(
    'PASS authenticated profile fetch/edit, no-op save, failed save preservation, normalized server write/cache/reload and discard confirmation',
  );
} finally {
  await browser.close();
}
