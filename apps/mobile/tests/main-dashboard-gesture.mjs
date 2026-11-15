import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  timezoneId: 'Asia/Seoul',
  reducedMotion: 'reduce',
});
await page.clock.setFixedTime(new Date('2026-11-14T12:00:00+09:00'));
await page.addInitScript(authenticatedSessionFixture);
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
await page.route('**/api/v1/diary**', (r) =>
  r.fulfill({ status: 404, json: { code: 'NOT_FOUND' } }),
);
const cdp = await page.context().newCDPSession(page);
async function swipe(x1, y1, x2, y2) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: x1, y: y1 }],
  });
  for (let i = 1; i <= 8; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: x1 + ((x2 - x1) * i) / 8, y: y1 + ((y2 - y1) * i) / 8 },
      ],
    });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}
try {
  await page.goto(`${process.env.MOBILE_URL ?? 'http://localhost:8241'}/main`);
  const week = page.getByTestId('home-week-calendar');
  await week.waitFor();
  const b = await week.boundingBox();
  const y = b.y + b.height / 2;
  await swipe(b.x + b.width - 20, y, b.x + 20, y);
  await page.waitForFunction(
    () =>
      document
        .querySelector('[aria-label="2026년 11월 21일"]')
        ?.getAttribute('aria-pressed') === 'true',
  );
  await swipe(b.x + 20, y, b.x + b.width - 20, y);
  await page.waitForFunction(
    () =>
      document
        .querySelector('[aria-label="2026년 11월 14일, 오늘"]')
        ?.getAttribute('aria-pressed') === 'true',
  );
  await swipe(b.x + b.width / 2, y, b.x + b.width / 2, y - 80);
  assert.equal(
    await page
      .getByRole('button', { name: '2026년 11월 14일, 오늘', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  assert(
    await week.evaluate((node) => {
      let p = node.parentElement;
      while (p) {
        if (p.scrollTop > 0) return true;
        p = p.parentElement;
      }
      return false;
    }),
    'vertical touch scroll is not captured as a week swipe',
  );
  console.log(
    'PASS real browser touch swipes change one week, preserve weekday, cancel day presses and allow vertical scrolling',
  );
} finally {
  await browser.close();
}
