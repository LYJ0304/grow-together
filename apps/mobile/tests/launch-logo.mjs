import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright-core';

const site = process.argv[2] ?? 'http://localhost:8156';
const artifacts = mkdtempSync(join(tmpdir(), 'grow-brand-'));
const type = process.env.LOGO_BROWSER === 'webkit' ? webkit : chromium;
const browser = await type.launch({
  executablePath:
    process.env.LOGO_BROWSER === 'webkit'
      ? process.env.WEBKIT_EXECUTABLE
      : (process.env.CHROME_EXECUTABLE ?? '/usr/bin/google-chrome'),
  args: process.env.LOGO_BROWSER === 'webkit' ? [] : ['--no-sandbox'],
});
const errors = [];
const page = await browser.newPage({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
});
page.on('pageerror', (error) => errors.push(error.message));
// Extend timers only while seeking/capturing artwork on slower CI machines.
// Separate contexts below test the real watchdog; the transition suite tests navigation timing.
await page.addInitScript(() => {
  const timeout = window.setTimeout;
  window.setTimeout = (callback, delay, ...args) =>
    timeout(
      callback,
      delay === 3500 ? 30000 : delay === 400 ? 2000 : delay,
      ...args,
    );
});
const logo = page.locator('.launch-logo');
const paths = logo.locator('path');
const navigate = () => page.goto(site);
try {
  await navigate();
  await logo.locator('svg').waitFor({ timeout: 10000 });
  await page.waitForSelector('.launch-logo[data-drawing="running"]');
  assert.deepEqual(await paths.evaluateAll((nodes) => nodes.map((n) => n.id)), [
    'enclosing-curve',
    'heart',
    'sprout',
    'accent-1',
    'accent-2',
    'accent-3',
  ]);
  const geometry = JSON.parse(
    readFileSync(
      new URL('../assets/images/brand/emblem.json', import.meta.url),
    ),
  );
  await paths.evaluateAll((nodes) =>
    nodes.forEach((n) =>
      n.getAnimations().forEach((a) => {
        a.pause();
        a.currentTime = 0;
      }),
    ),
  );
  await page.evaluate(() => {
    window.drawingAnimations = [
      ...document.querySelectorAll('.launch-logo path'),
    ].map((n) => n.getAnimations()[0]);
  });
  await page.setViewportSize({ width: 360, height: 640 });
  assert(
    await page.evaluate(() =>
      [...document.querySelectorAll('.launch-logo path')].every(
        (n, i) => n.getAnimations()[0] === window.drawingAnimations[i],
      ),
    ),
    'Resize rerenders must preserve animation instances',
  );
  await page.setViewportSize({ width: 393, height: 852 });
  const rect = await logo.boundingBox();
  await page.screenshot({ path: join(artifacts, 'initial.png') });
  for (const [index, time] of [450, 1400, 2150].entries()) {
    await paths.evaluateAll(
      (nodes, time) =>
        nodes.forEach((n) =>
          n.getAnimations().forEach((a) => {
            a.currentTime = time;
          }),
        ),
      time,
    );
    const offsets = await paths.evaluateAll((nodes) =>
      nodes.map((n) => parseFloat(getComputedStyle(n).strokeDashoffset)),
    );
    for (let i = 0; i < geometry.strokes.length; i++) {
      const stroke = geometry.strokes[i];
      const expected =
        1 -
        Math.max(0, Math.min(1, (time - stroke.delayMs) / stroke.durationMs));
      assert(
        Math.abs(offsets[i] - expected) < 0.015,
        `Stroke ${stroke.id} must follow its linear timeline`,
      );
    }
    await page.screenshot({ path: join(artifacts, `phase-${index + 1}.png`) });
    assert.deepEqual(
      await logo.boundingBox(),
      rect,
      'Drawing cannot shift layout',
    );
  }
  await paths.evaluateAll((nodes) =>
    nodes.forEach((n) =>
      n.getAnimations().forEach((a) => {
        a.currentTime = 2390;
        a.play();
      }),
    ),
  );
  await page.waitForSelector('.launch-logo[data-drawing="done"]');
  await page.screenshot({ path: join(artifacts, 'completed-screen.png') });
  const completed = await logo.screenshot({
    path: join(artifacts, 'completed.png'),
  });
  assert.deepEqual(
    await paths.evaluateAll((nodes) =>
      nodes.map((n) => ({
        id: n.id,
        d: n.getAttribute('d'),
        stroke: n.getAttribute('stroke'),
        strokeWidth: Number(n.getAttribute('stroke-width')),
      })),
    ),
    geometry.strokes.map(({ id, d, stroke, strokeWidth }) => ({
      id,
      d,
      stroke,
      strokeWidth,
    })),
  );
  await page.waitForTimeout(40);
  assert.deepEqual(
    await logo.screenshot(),
    completed,
    'Completed emblem must not flicker',
  );
  const artwork = readFileSync(
    new URL('../assets/images/brand/emblem.svg', import.meta.url),
    'utf8',
  );
  await logo.evaluate((node, svg) => {
    node.innerHTML = svg;
  }, artwork);
  assert.deepEqual(
    await logo.screenshot(),
    completed,
    'Final pixels must match the static vector',
  );
  await page.waitForURL('**/app-name');
  await page.goBack();
  await page.waitForSelector('.launch-logo[data-drawing="done"]');
  assert.equal(
    await paths.evaluateAll(
      (nodes) => nodes.flatMap((n) => n.getAnimations()).length,
    ),
    0,
    'Returning cannot replay',
  );
  await page
    .getByRole('button', { name: '앱 이름 화면으로 이동', exact: true })
    .click();
  await page.waitForURL('**/app-name');
  console.log(
    'PASS ordered linear drawing, stable layout, final artwork, completion, history, navigation',
  );

  await navigate();
  await page.waitForSelector('.launch-logo[data-drawing="running"]');
  await page.evaluate(() => {
    window.logoAnimations = [
      ...document.querySelectorAll('.launch-logo path'),
    ].flatMap((n) => n.getAnimations());
  });
  await page
    .getByRole('button', { name: '앱 이름 화면으로 이동', exact: true })
    .click({ clickCount: 2 });
  await page.waitForURL('**/app-name');
  assert(
    await page.evaluate(() =>
      window.logoAnimations.every((a) => a.playState === 'idle'),
    ),
    'Skip must dispose drawing animations',
  );
  console.log('PASS rapid tap skip and animation cleanup');

  await navigate();
  await page.waitForSelector('.launch-logo[data-drawing="running"]');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForSelector('.launch-logo[data-drawing="done"]');
  assert.equal(
    await paths.evaluateAll(
      (nodes) => nodes.flatMap((n) => n.getAnimations()).length,
    ),
    0,
  );
  await page.waitForURL('**/app-name');
  console.log('PASS live reduced motion completes and navigates');

  // Extend only the reduced-motion screenshot hold; natural navigation was tested above.
  await page.addInitScript(() => {
    const timeout = window.setTimeout;
    window.setTimeout = (callback, delay, ...args) =>
      timeout(callback, delay === 120 ? 1000 : delay, ...args);
  });
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 360, height: 640 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await navigate();
    await page.waitForSelector('.launch-logo[data-drawing="done"]');
    const box = await logo.boundingBox();
    assert(box.width > 0 && box.x >= 0 && box.x + box.width <= viewport.width);
    await page.screenshot({
      path: join(artifacts, `reduced-${viewport.width}.png`),
    });
    await page.waitForURL('**/app-name');
  }
  console.log(
    'PASS reduced motion at small iPhone, modern iPhone, Android-sized and desktop viewports',
  );

  const fallback = await browser.newPage();
  fallback.on('pageerror', (error) => errors.push(error.message));
  await fallback.addInitScript(() => {
    Element.prototype.animate = undefined;
  });
  await fallback.goto(site);
  await fallback.waitForSelector('.launch-logo[data-drawing="done"]');
  assert.equal(await fallback.locator('.launch-logo path').count(), 6);
  await fallback.waitForURL('**/app-name');
  await fallback.close();
  const stalled = await browser.newPage();
  stalled.on('pageerror', (error) => errors.push(error.message));
  await stalled.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const result = animate.apply(this, args);
      result.pause();
      return result;
    };
  });
  await stalled.goto(site);
  await stalled.waitForURL('**/app-name', { timeout: 10000 });
  await stalled.close();
  console.log('PASS watchdog completes a stalled animation');
  assert.deepEqual(errors, []);
  console.log(
    'PASS static fallback when animation is unavailable; no browser errors',
  );
  console.log(`Screenshots: ${artifacts}`);
} finally {
  await browser.close();
}
