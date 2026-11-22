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
await page.route('**/api/v1/reports**', (r) => r.fulfill({ json: [] }));
await page.route('**/api/v1/diary**', (r) =>
  r.fulfill(
    new URL(r.request().url()).searchParams.has('month')
      ? { json: [] }
      : { status: 404, json: { code: 'NOT_FOUND' } },
  ),
);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('/tmp/common-header-shots', { recursive: true });
try {
  for (const width of [320, 390, 430, 768, 1200]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['todo', 'main', 'calendar', 'report', 'chat']) {
      await page.goto(`${base}/${route}`);
      await page
        .getByRole('button', { name: '내 프로필 열기', exact: true })
        .waitFor();
      const header = page.getByTestId('app-header');
      assert.equal(await header.count(), 1);
      assert.equal(
        await header.getByText('같이 키우기', { exact: true }).count(),
        1,
        'primary screens share a visible brand header',
      );
      const bounds = await header.boundingBox();
      assert.equal(
        bounds.y,
        0,
        'primary tab headers start at the same safe-area edge on web',
      );
      assert(
        bounds.height >= 52 && bounds.height <= 56,
        'compact header without embedded safe area',
      );
      const profile = await page
        .getByRole('button', { name: '내 프로필 열기', exact: true })
        .boundingBox();
      assert(profile.width >= 44 && profile.height >= 44);
      assert(
        profile.y >= bounds.y &&
          profile.y + profile.height <= bounds.y + bounds.height,
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.equal(
        await page
          .getByRole('tablist')
          .filter({ has: page.getByRole('tab', { name: '오늘', exact: true }) })
          .getByRole('tab')
          .count(),
        5,
      );
      if (route === 'todo') {
        const intro = await page
          .getByText('PLAN THE DAY', { exact: true })
          .boundingBox();
        assert(
          intro.y - (bounds.y + bounds.height) <= 12,
          'schedule intro follows header without large spacer',
        );
        await page.screenshot({
          path: `/tmp/common-header-shots/todo-${width}.png`,
        });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/todo`);
  await page
    .getByRole('button', { name: '내 프로필 열기', exact: true })
    .click();
  await page.waitForURL('**/mypage');
  await page
    .getByRole('button', { name: '이전 화면으로', exact: true })
    .click();
  await page.waitForURL('**/todo');
  await page
    .getByRole('button', { name: '내 프로필 열기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '아이 정보 관리', exact: true })
    .click();
  await page.waitForURL('**/children');
  const back = page.getByRole('button', {
    name: '이전 화면으로 돌아가기',
    exact: true,
  });
  assert.equal((await back.innerText()).trim(), '', 'detail back is an icon');
  await back.click();
  await page.waitForURL('**/mypage');
  await page.evaluate(() => (document.documentElement.style.fontSize = '24px'));
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS shared compact header across five tabs, 25 viewport/routes, profile navigation and detail back',
  );
} finally {
  await browser.close();
}
