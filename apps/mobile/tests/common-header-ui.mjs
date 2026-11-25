import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ reducedMotion: 'reduce' });
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(120000);
const base = process.env.MOBILE_URL ?? 'http://localhost:8290';
await page.addInitScript(authenticatedSessionFixture);
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/users/me', (r) =>
  r.fulfill({ json: { id: 1, name: '보호자', email: 'parent@example.test' } }),
);
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
await page.route('**/api/v1/diary**', (r) =>
  r.fulfill(
    new URL(r.request().url()).searchParams.has('month')
      ? { json: [] }
      : { status: 404, json: { code: 'NOT_FOUND' } },
  ),
);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('/tmp/remove-header-shots', { recursive: true });
try {
  for (const width of [320, 390, 430, 768, 1200]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['main', 'calendar', 'chat']) {
      await page.goto(`${base}/${route}`);
      await page.getByRole('tab', { name: '마이', exact: true }).waitFor();
      assert.equal(await page.getByTestId('app-header').count(), 0);
      assert.equal(
        await page.getByText('같이 키우기', { exact: true }).count(),
        0,
      );
      assert.equal(
        await page
          .getByRole('button', { name: '내 프로필 열기', exact: true })
          .count(),
        0,
      );
      assert.equal(await page.getByRole('tab').count(), 4);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      if (route === 'main') {
        const date = await page.getByTestId('home-day-heading').boundingBox();
        assert(
          date.y <= 32,
          'date starts near safe area without the removed navigation row',
        );
      }
      if (width === 390)
        await page.screenshot({
          path: `/tmp/remove-header-shots/${route}.png`,
        });
    }
  }
  await page.goto(`${base}/diary`);
  const back = page.getByRole('button', {
    name: '기록으로 돌아가기',
    exact: true,
  });
  await back.waitFor();
  const bounds = await back.boundingBox();
  assert(
    bounds.width >= 44 && bounds.height >= 44,
    'detail back target is retained',
  );
  assert.equal((await back.innerText()).trim(), '');
  assert.equal(await page.getByTestId('app-header').count(), 1);
  assert.deepEqual(errors, []);
  console.log(
    'PASS no brand row across 15 route/viewports; four tabs, compact content and detail back retained',
  );
} finally {
  await browser.close();
}
