import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 320, height: 568 },
  timezoneId: 'Asia/Seoul',
});
await page.addInitScript(authenticatedSessionFixture);
await page.route('**/api/v1/children**', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
try {
  await page.goto(
    (process.env.MOBILE_URL ?? 'http://localhost:8156') + '/main',
    { timeout: 120000, waitUntil: 'commit' },
  );
  await page.getByRole('tablist').waitFor({ timeout: 120000 });
  assert.deepEqual(
    await page
      .getByRole('tab')
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('aria-label')),
      ),
    ['오늘', '일정', '기록', '리포트', '질문'],
  );
  await page.getByRole('button', { name: '앱 설정', exact: true }).click();
  await page.waitForURL('**/mypage');
  await page
    .getByRole('button', { name: '이전 화면으로', exact: true })
    .click();
  await page.getByRole('tab', { name: '일정', exact: true }).click();
  const dateButtons = page.locator('[aria-pressed]');
  const other = dateButtons.nth(1);
  const selectedLabel = await other.getAttribute('aria-label');
  await other.click();
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  await page
    .getByRole('textbox', { name: '상담 질문 입력', exact: true })
    .fill('질문 초안');
  await page.getByRole('tab', { name: '일정', exact: true }).click();
  assert.equal(
    await page
      .getByRole('button', { name: selectedLabel, exact: true })
      .getAttribute('aria-pressed'),
    'true',
    'Selected date survives tab return',
  );
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  assert.equal(
    await page
      .getByRole('textbox', { name: '상담 질문 입력', exact: true })
      .inputValue(),
    '질문 초안',
  );
  await page
    .getByRole('heading', { name: '육아 도우미', exact: true })
    .waitFor();
  console.log('PASS five tabs, profile, selected date and question draft');
} finally {
  await browser.close();
}
