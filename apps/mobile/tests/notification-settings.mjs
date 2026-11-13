import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';

const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
page.setDefaultTimeout(12000);
await page.addInitScript(authenticatedSessionFixture);
await page.route('**/api/v1/children/me', (route) =>
  route.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
const writes = [];
page.on('request', (request) => {
  if (request.url().includes('/api/') && request.method() !== 'GET')
    writes.push(request.url());
});
await page.addInitScript(() => {
  window.notificationPermissionRequests = 0;
  if (window.Notification) {
    Notification.requestPermission = async () => {
      window.notificationPermissionRequests++;
      return 'denied';
    };
  }
});
const base = process.env.MOBILE_URL ?? 'http://localhost:8215';
await mkdir('/tmp/grow-notification-203', { recursive: true });
try {
  await page.goto(`${base}/mypage`);
  await page.getByRole('heading', { name: '설정', exact: true }).waitFor();
  await page.getByRole('heading', { name: '알림 설정', exact: true }).waitFor();
  await page
    .getByText(
      '알림 기능은 준비 중이에요. 기능이 연결되면 여기에서 설정할 수 있어요.',
      { exact: true },
    )
    .waitFor();
  for (const name of ['일정 알림', '일기 작성 알림']) {
    const control = page.getByRole('switch', { name, exact: true });
    assert(
      await control.isDisabled(),
      `${name} is unavailable until connected`,
    );
    assert.equal(await control.isChecked(), false);
    await control.click({ force: true });
    assert.equal(await control.isChecked(), false);
  }
  for (const width of [320, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page
      .getByRole('heading', { name: '알림 설정', exact: true })
      .scrollIntoViewIfNeeded();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    for (const name of ['일정 알림', '일기 작성 알림']) {
      const bounds = await page
        .getByRole('switch', { name, exact: true })
        .boundingBox();
      assert(bounds.x >= 0 && bounds.x + bounds.width <= width);
    }
    await page.screenshot({
      path: `/tmp/grow-notification-203/settings-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('div')) {
      if (element.childElementCount === 0 && element.textContent.trim()) {
        const style = getComputedStyle(element);
        element.style.fontSize = `${parseFloat(style.fontSize) * 2}px`;
        element.style.lineHeight = `${parseFloat(style.lineHeight) * 2}px`;
      }
    }
  });
  for (const name of ['일정 알림', '일기 작성 알림']) {
    const label = await page.getByText(name, { exact: true }).boundingBox();
    const control = await page
      .getByRole('switch', { name, exact: true })
      .boundingBox();
    assert(
      label.x + label.width <= control.x,
      'Large labels do not overlap controls',
    );
  }
  await page.screenshot({
    path: '/tmp/grow-notification-203/settings-large-text.png',
    fullPage: true,
  });
  assert.deepEqual(writes, []);
  assert.equal(
    await page.evaluate(() => window.notificationPermissionRequests),
    0,
  );
  await page.getByRole('button', { name: /^아이 프로필/ }).click();
  await page.waitForURL('**/children');
  await page.goto(`${base}/mypage`);
  await page.getByRole('button', { name: '기록 관리 ›', exact: true }).click();
  await page.waitForURL('**/calendar');
  console.log(
    'PASS notification preparation UI, disabled off controls, responsive layout, no permission/write effects, existing settings links',
  );
} finally {
  await browser.close();
}
