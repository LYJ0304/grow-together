import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 700 } });
page.setDefaultTimeout(12000);
await page.addInitScript(authenticatedSessionFixture);
await page.clock.setFixedTime(new Date('2026-11-08T12:00:00'));
let profile = { name: '하늘', birthday: '2025-11-09' },
  status = 200;
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ status, json: status === 200 ? profile : {} }),
);
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
const url = process.env.MAIN_URL ?? 'http://localhost:8156';
const heading = (name) => page.getByRole('heading', { name, exact: true });
try {
  await page.goto(`${url}/main`, { waitUntil: 'commit', timeout: 120000 });
  await heading('하늘의 하루 · 11개월').waitFor();
  await page.getByRole('button', { name: '앱 설정', exact: true }).click();
  await page.waitForURL('**/mypage');
  await page
    .getByRole('button', { name: '이전 화면으로', exact: true })
    .click();
  profile = { name: '바다', birthday: '2025-11-08' };
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  // Profile reload is tied to screen focus, not arbitrary window focus.
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await heading('바다의 하루 · 12개월').waitFor();
  status = 500;
  await page.reload();
  await page
    .getByRole('alert')
    .filter({ hasText: '아이 정보를 불러오지 못했어요.' })
    .waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: '아이 정보 등록하기', exact: true })
      .count(),
    0,
  );
  status = 200;
  await page
    .getByRole('button', { name: '아이 정보 다시 시도', exact: true })
    .click();
  await heading('바다의 하루 · 12개월').waitFor();
  status = 404;
  await page.reload();
  await page.getByText('아이와 함께하는 첫 기록', { exact: true }).waitFor();
  await page
    .getByRole('button', { name: '아이 정보 등록하기', exact: true })
    .click();
  await page.waitForURL('**/children');
  console.log(
    'PASS child months, profile/settings entry, focus refresh and missing/error separation',
  );
} finally {
  await browser.close();
}
