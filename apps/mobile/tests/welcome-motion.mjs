import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base = process.env.MOBILE_URL ?? 'http://localhost:8291';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  for (const reduced of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(120000);
    await page.addInitScript(() => {
      window.welcomeFrames = [];
      const sample = () => {
        const overlay = document.querySelector(
          '[data-testid="launch-transition-title"]',
        );
        const heading = [...document.querySelectorAll('[role="heading"]')].find(
          (n) => n.textContent === '같이 키우기',
        );
        const buttons = [...document.querySelectorAll('[role="button"]')];
        window.welcomeFrames.push({
          route: location.pathname,
          overlayY: overlay?.getBoundingClientRect().y ?? null,
          titleY: heading?.getBoundingClientRect().y ?? null,
          visible: heading
            ? Number(getComputedStyle(heading).opacity) > 0
            : false,
          disabled:
            buttons.length > 0 &&
            buttons.every((n) => n.getAttribute('aria-disabled') === 'true'),
        });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.goto(base + '/');
    await page.waitForURL('**/welcome', { timeout: 30000 });
    await page.getByRole('button', { name: '로그인', exact: true }).waitFor();
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="launch-transition"]'),
    );
    const frames = await page.evaluate(() => window.welcomeFrames);
    const routes = frames
      .map((f) => f.route)
      .filter((r, i, a) => i === 0 || r !== a[i - 1]);
    assert.deepEqual(routes, ['/', '/app-name', '/welcome']);
    const motion = frames.filter(
      (f) => f.route === '/welcome' && f.overlayY !== null,
    );
    if (reduced)
      assert.equal(motion.length, 0, 'reduced motion has no traveling title');
    else {
      assert(
        motion.length >= 2,
        'welcome retains visible intermediate title frames',
      );
      assert(
        motion.some((f) => f.disabled),
        'welcome actions remain blocked during the transition',
      );
      const target = await page
        .getByRole('heading', { name: '같이 키우기', exact: true })
        .boundingBox();
      assert(
        Math.abs(motion.at(-1).overlayY - target.y) < 4,
        'traveling title lands without a position jump',
      );
    }
    assert.equal(
      await page
        .getByRole('button', { name: '로그인', exact: true })
        .isDisabled(),
      false,
    );
    await page.goBack();
    await page.waitForURL('**/app-name');
    await page.waitForTimeout(1100);
    assert.equal(
      new URL(page.url()).pathname,
      '/app-name',
      'back does not restart automatic progression',
    );
    await page.goForward();
    await page.waitForURL('**/welcome');
    assert.equal(
      await page.getByTestId('launch-transition').count(),
      0,
      'forward restores the settled welcome',
    );
    console.log(
      `PASS automatic intro/app-name/welcome, title landing, transition blocking, back/forward and reducedMotion=${reduced}`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
