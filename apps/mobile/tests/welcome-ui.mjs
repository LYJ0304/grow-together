import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const base = process.env.MOBILE_URL ?? 'http://localhost:8291';
const artifacts = '/tmp/welcome-polish';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
});
page.setDefaultNavigationTimeout(120000);
page.setDefaultTimeout(30000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const login = () => page.getByRole('button', { name: '로그인', exact: true });
const signup = () =>
  page.getByRole('button', { name: '가입하기', exact: true });
try {
  await page.goto(base + '/welcome');
  await login().waitFor();
  if (process.env.WELCOME_BASELINE)
    await page.screenshot({ path: artifacts + '/before-390.png' });
  await page
    .getByText('아이와 함께한 하루, 작은 순간까지 기록해요.', { exact: true })
    .waitFor();
  assert.equal(
    await page.getByText('시작해볼까요?', { exact: true }).count(),
    0,
  );
  for (const [width, height] of [
    [320, 568],
    [375, 667],
    [390, 844],
    [430, 932],
    [1024, 768],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(base + '/welcome');
    await login().waitFor();
    const heading = page.getByRole('heading', {
      name: '같이 키우기',
      exact: true,
    });
    assert.equal(await heading.count(), 1);
    const type = await heading.evaluate((n) => ({
      font: getComputedStyle(n).fontFamily,
      size: parseFloat(getComputedStyle(n).fontSize),
    }));
    assert(type.font.includes('Jua'));
    assert.equal(type.size, 35, 'preserve launch title typography');
    const logo = page.locator('img').first();
    await logo.waitFor();
    const image = await logo.boundingBox();
    assert(image.width >= 96 && image.width <= 112);
    for (const button of [login(), signup()]) {
      const b = await button.boundingBox();
      assert(b.width >= 44 && b.height >= 44);
    }
    const size = await login().boundingBox();
    assert(size.height >= 52 && size.height <= 56);
    assert(size.width <= 440);
    const typography = await login().evaluate(
      (n) => getComputedStyle(n.querySelector('[dir="auto"]')).fontFamily,
    );
    assert(
      !typography.includes('Jua'),
      'action uses shared readable typography',
    );
    assert.equal(
      await login().evaluate((n) => getComputedStyle(n).boxShadow),
      'none',
    );
    assert.equal(
      await signup().evaluate((n) => getComputedStyle(n).backgroundColor),
      'rgba(0, 0, 0, 0)',
      'sign-up is a quiet text action',
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (height >= 568) {
      const end = await signup().boundingBox();
      assert(
        end.y + end.height <= height,
        'both actions visible on normal phone heights',
      );
    }
    await signup().scrollIntoViewIfNeeded();
    assert(await signup().isVisible());
    if (width === 390)
      await page.screenshot({ path: artifacts + '/after-390.png' });
    if (width === 320)
      await page.screenshot({ path: artifacts + '/after-320.png' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/welcome');
  await login().click();
  await page.waitForURL('**/login');
  await page.goBack();
  await signup().click();
  await page.waitForURL('**/signup');
  await page.goBack();
  await login().focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/login');
  await page.goto(base + '/welcome');
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[dir="auto"]')) {
      const css = getComputedStyle(el);
      el.style.fontSize = parseFloat(css.fontSize) * 1.5 + 'px';
      el.style.lineHeight = parseFloat(css.lineHeight) * 1.5 + 'px';
    }
  });
  await signup().scrollIntoViewIfNeeded();
  assert(await signup().isVisible());
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS welcome value copy, grouped identity, responsive/short/large-text bounds, touch targets, quiet sign-up, login/signup and keyboard navigation',
  );
} finally {
  await browser.close();
}
