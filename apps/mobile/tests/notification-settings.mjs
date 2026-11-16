import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.addInitScript(authenticatedSessionFixture);
await page.addInitScript(() => {
  window.notificationPermissionRequests = 0;
  if (window.Notification)
    Notification.requestPermission = async () => {
      window.notificationPermissionRequests++;
      return 'denied';
    };
});
let writes = 0;
page.on('request', (r) => {
  if (r.url().includes('/api/') && r.method() !== 'GET') writes++;
});
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2024-01-01' } }),
);
await page.route('**/api/v1/users/me', (r) =>
  r.fulfill({ json: { id: 1, name: '보호자', email: 'parent@example.com' } }),
);
try {
  await page.goto(
    `${process.env.MOBILE_URL ?? 'http://localhost:8271'}/mypage`,
  );
  await page.getByText('알림 기능은 준비 중이에요.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('switch').count(), 0);
  for (const width of [320, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: 720 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  assert.equal(writes, 0);
  assert.equal(
    await page.evaluate(() => window.notificationPermissionRequests),
    0,
  );
  await page
    .getByRole('button', { name: '아이 정보 관리', exact: true })
    .click();
  await page.waitForURL('**/children');
  console.log(
    'PASS honest notification notice without inactive switches, no writes, responsive account/child navigation',
  );
} finally {
  await browser.close();
}
