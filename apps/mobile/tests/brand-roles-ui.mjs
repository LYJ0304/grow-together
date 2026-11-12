import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const colors = vm.runInNewContext(
  readFileSync(
    new URL('../src/theme/colors.ts', import.meta.url),
    'utf8',
  ).replace('export const colors =', 'const colors =') + '\ncolors',
);
const rgb = (hex) =>
  'rgb(' +
  hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16))
    .join(', ') +
  ')';
const luminance = (css) => {
  const c = css
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map((v) => Number(v) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c.reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
};
const ratio = (a, b) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) /
  (Math.min(luminance(a), luminance(b)) + 0.05);
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
});
const base = process.env.MOBILE_URL ?? 'http://localhost:8188';
const buttonColors = (button) =>
  button.evaluate((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    fg: getComputedStyle(el.querySelector('[dir="auto"]')).color,
    opacity: getComputedStyle(el).opacity,
  }));
try {
  await page.goto(base + '/login', { timeout: 120000 });
  const login = page.getByRole('button', { name: '로그인', exact: true });
  await login.waitFor();
  let pair = await buttonColors(login);
  assert.equal(
    pair.bg,
    rgb(colors.brand),
    'Normal auth CTA must use bright brand fill',
  );
  assert.equal(pair.fg, rgb(colors.onBrand));
  assert(ratio(pair.bg, pair.fg) >= 4.5);
  const bounds = await login.boundingBox();
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(100);
  pair = await buttonColors(login);
  assert.equal(pair.opacity, '1', 'Pressed CTA must not fade its text');
  assert(ratio(pair.bg, pair.fg) >= 4.5);
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await page.screenshot({ path: '/tmp/brand188-auth.png' });
  const home = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await home.addInitScript(authenticatedSessionFixture);
  await home.route('**/api/v1/children/me', (r) =>
    r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
  );
  await home.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
  await home.goto(base + '/main');
  const make = home.getByRole('button', { name: '일정 만들기', exact: true });
  await make.waitFor();
  const secondary = await buttonColors(make);
  assert.equal(secondary.bg, rgb(colors.tint));
  assert(ratio(secondary.bg, secondary.fg) >= 4.5);
  const active = home.getByRole('tab', { name: '오늘', exact: true });
  await active.locator('img').first().waitFor();
  assert.equal(await active.getAttribute('aria-selected'), 'true');
  const headerIcon = home
    .getByRole('button', { name: '아이 프로필 열기', exact: true })
    .locator('img');
  await headerIcon.waitFor();
  await home.screenshot({ path: '/tmp/brand188-home.png' });
  await home.setViewportSize({ width: 1280, height: 900 });
  assert(
    await home.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await home.screenshot({ path: '/tmp/brand188-home-wide.png' });
  await home.setViewportSize({ width: 390, height: 844 });
  await home.getByRole('tab', { name: '리포트', exact: true }).click();
  const reportCTA = home.getByRole('button', {
    name: '일정 확인하기',
    exact: true,
  });
  await reportCTA.waitFor();
  const reportPair = await buttonColors(reportCTA);
  assert(ratio(reportPair.bg, reportPair.fg) >= 4.5);
  await home.close();
  const missing = await browser.newPage({ reducedMotion: 'reduce' });
  await missing.addInitScript(authenticatedSessionFixture);
  await missing.route('**/api/v1/children/me', (r) =>
    r.fulfill({ status: 404, json: { code: 'NOT_FOUND' } }),
  );
  await missing.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
  await missing.goto(base + '/main');
  const register = missing.getByRole('button', {
    name: '아이 정보 등록하기',
    exact: true,
  });
  await register.waitFor();
  const sharedPair = await buttonColors(register);
  assert.equal(
    sharedPair.bg,
    rgb(colors.brand),
    'Shared primary CTA must use coral',
  );
  assert.equal(sharedPair.fg, rgb(colors.onBrand));
  assert(ratio(sharedPair.bg, sharedPair.fg) >= 4.5);
  await register.click();
  await missing.waitForURL('**/onboarding');
  await missing.close();
  console.log(
    'PASS rendered bright auth CTA and pressed contrast, shared registration CTA/routing, tint secondary and report CTA; accessible selected state preserved',
  );
} finally {
  await browser.close();
}
