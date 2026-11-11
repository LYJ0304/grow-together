import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const base = process.env.MOBILE_URL ?? 'http://localhost:8181';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const title = '우리 아이를 등록해주세요';
const context = await browser.newContext({
  viewport: { width: 320, height: 700 },
  reducedMotion: 'reduce',
});
await context.addInitScript(authenticatedSessionFixture);
const page = await context.newPage();
page.setDefaultTimeout(12000);
let profile = null,
  failure = false,
  held,
  release;
await page.route('**/api/v1/children/me', async (r) => {
  if (r.request().method() !== 'GET') {
    profile = r.request().postDataJSON();
    return r.fulfill({ status: 201, json: profile });
  }
  if (held) await held;
  return r.fulfill(
    failure
      ? { status: 500, json: {} }
      : profile
        ? { json: profile }
        : { status: 404, json: { code: 'NOT_FOUND' } },
  );
});
let generations = 0;
await page.route('**/api/v1/todos**', (r) => {
  if (r.request().url().includes('/generate')) generations++;
  return r.fulfill({ json: [] });
});
const click = (name) => page.getByRole('button', { name, exact: true }).click();
const modal = () => page.getByRole('dialog', { name: title, exact: true });
try {
  held = new Promise((resolve) => {
    release = resolve;
  });
  await page.goto(base + '/main', { timeout: 120000 });
  await page.waitForTimeout(300);
  assert.equal(
    await modal().count(),
    0,
    'Loading cannot establish missing data',
  );
  held = null;
  release();
  await modal().waitFor();
  assert.equal(await modal().count(), 1);
  assert(
    (await page.locator('[role="tablist"]').count()) === 1,
    'Main must remain available beneath the optional prompt',
  );
  assert.equal(
    await page.getByRole('tablist').count(),
    0,
    'Dialog must hide underlying navigation from accessibility',
  );
  await page.screenshot({ path: '/tmp/child181-prompt-320.png' });
  await page.waitForFunction(() =>
    document.querySelector('[role="dialog"]')?.contains(document.activeElement),
  );
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    assert(
      await modal().evaluate((el) => el.contains(document.activeElement)),
      'Keyboard focus must remain in the dialog',
    );
  }
  for (const [width, height] of [
    [390, 844],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page
      .getByRole('button', { name: '나중에 등록하기', exact: true })
      .scrollIntoViewIfNeeded();
    const button = await page
      .getByRole('button', { name: '나중에 등록하기', exact: true })
      .boundingBox();
    assert(
      button.y >= 0 && button.y + button.height <= height,
      'Dialog actions must remain reachable on short screens',
    );
    await page.screenshot({ path: `/tmp/child181-prompt-${width}.png` });
  }
  await page.setViewportSize({ width: 320, height: 700 });
  await click('나중에 등록하기');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(300);
  assert.equal(
    await modal().count(),
    0,
    'Refetch must not repeat the initial prompt',
  );
  await page.getByRole('tab', { name: '일정', exact: true }).click();
  await click('활동 추천받기');
  await modal().waitFor();
  assert.equal(
    generations,
    0,
    'Missing child cannot start personalized generation',
  );
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  assert.equal(
    await modal().count(),
    0,
    'Tab return must not repeat the prompt',
  );
  await click('아이 정보 등록하기');
  await page
    .getByRole('heading', { name: '아이를 소개해 주세요', exact: true })
    .waitFor();
  await click('메인으로 돌아가기');
  await page
    .getByRole('heading', { name: '무엇이 궁금하세요?', exact: true })
    .waitFor();
  assert.equal(
    await modal().count(),
    0,
    'Incomplete registration return must not loop',
  );
  await click('아이 정보 등록하기');
  await page
    .getByRole('textbox', { name: '아이 이름 또는 애칭', exact: true })
    .fill('하늘');
  await page.getByLabel('생년월일', { exact: true }).fill('2024-03-15');
  await click('다음');
  await click('건너뛰기');
  await click('건너뛰기');
  await click('건너뛰기');
  await click('같이 키우기 시작하기');
  await page.getByRole('heading', { name: /하늘의 하루/ }).waitFor();
  assert.equal(
    await modal().count(),
    0,
    'Successful registration must refresh the shared profile',
  );
  await page.reload();
  await page.getByRole('heading', { name: /하늘의 하루/ }).waitFor();
  assert.equal(
    await modal().count(),
    0,
    'Existing profile must not prompt after reload',
  );
  console.log(
    'PASS missing/loading, one prompt, dismissal/refetch/tab/back policy, feature gate, registration and shared cache refresh',
  );
} catch (error) {
  console.error(await page.locator('body').innerText());
  throw error;
} finally {
  await context.close();
  await browser.close();
}
