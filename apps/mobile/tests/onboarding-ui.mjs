import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 320, height: 700 },
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
await page.addInitScript(authenticatedSessionFixture);
let profile = null,
  failSave = true,
  writes = 0;
await page.route('**/api/v1/children/me', async (r) => {
  if (r.request().method() === 'GET')
    return r.fulfill(
      profile
        ? { json: profile }
        : { status: 404, json: { code: 'NOT_FOUND' } },
    );
  writes++;
  if (failSave)
    return r.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR' } });
  profile = r.request().postDataJSON();
  return r.fulfill({ status: 201, json: profile });
});
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
const click = (name) => page.getByRole('button', { name, exact: true }).click();
try {
  await page.goto(`${process.env.MOBILE_URL ?? 'http://localhost:8160'}/main`, {
    waitUntil: 'commit',
    timeout: 120000,
  });
  await page
    .getByRole('heading', { name: '아이를 소개해 주세요', exact: true })
    .waitFor();
  assert.equal(await page.getByRole('tablist').count(), 0);
  await page.screenshot({ path: '/tmp/onboard171-first-step.png' });
  await page
    .getByRole('textbox', { name: '아이 이름 또는 애칭', exact: true })
    .fill('  하늘  ');
  await page.getByLabel('생년월일', { exact: true }).fill('2024-03-15');
  await page.getByRole('radio', { name: '네', exact: true }).click();
  await page.getByLabel('출산 예정일', { exact: true }).fill('2024-04-15');
  await click('다음');
  await page.getByRole('checkbox', { name: '수면', exact: true }).click();
  await page.getByRole('checkbox', { name: '식사', exact: true }).click();
  await page
    .getByRole('checkbox', { name: '언어와 소통', exact: true })
    .click();
  assert.equal(
    await page
      .getByRole('checkbox', { name: '언어와 소통', exact: true })
      .getAttribute('aria-checked'),
    'false',
  );
  await page
    .getByRole('checkbox', { name: '특별한 고민 없음', exact: true })
    .click();
  assert.equal(
    await page
      .getByRole('checkbox', { name: '수면', exact: true })
      .getAttribute('aria-checked'),
    'false',
  );
  await page.getByRole('checkbox', { name: '수면', exact: true }).click();
  await page.reload({ waitUntil: 'commit' });
  await click('이어서 작성하기');
  assert.equal(
    await page
      .getByRole('checkbox', { name: '수면', exact: true })
      .getAttribute('aria-checked'),
    'true',
  );
  await click('다음');
  await page
    .getByText('검토된 질문을 준비하고 있어요.', { exact: true })
    .waitFor();
  await click('건너뛰기');
  await page.getByRole('radio', { name: '10분 정도', exact: true }).click();
  await click('다음');
  await click('같이 키우기 시작하기');
  await page
    .getByRole('button', { name: '기존 등록 정보 확인', exact: true })
    .waitFor();
  assert.equal(writes, 1);
  assert(
    await page
      .getByRole('button', { name: '같이 키우기 시작하기', exact: true })
      .isDisabled(),
  );
  assert.equal(
    writes,
    1,
    'uncertain write must be checked before resubmitting',
  );
  await click('기존 등록 정보 확인');
  failSave = false;
  await click('같이 키우기 시작하기');
  await page.getByRole('tablist').waitFor();
  assert.equal(profile.name, '하늘');
  assert.equal(profile.personalization.expectedDueDate, '2024-04-15');
  assert.deepEqual(profile.personalization.concerns, ['sleep']);
  assert.equal(profile.personalization.availableActivityTime, '10min');
  assert.equal(
    await page.evaluate(() =>
      Object.keys(sessionStorage).some((k) =>
        k.startsWith('growtogether.onboarding'),
      ),
    ),
    false,
  );
  await page.reload({ waitUntil: 'commit' });
  await page.getByRole('tablist').waitFor();
  assert.equal(
    await page
      .getByRole('heading', { name: '아이를 소개해 주세요', exact: true })
      .count(),
    0,
  );
  console.log(
    'PASS onboarding UI: new-user gate, five steps, exclusive concerns, reload draft, failure/uncertain check, real payload, existing-user skip',
  );
} catch (error) {
  console.log('UI state:', await page.locator('body').innerText());
  throw error;
} finally {
  await browser.close();
}
