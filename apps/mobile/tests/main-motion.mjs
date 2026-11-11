import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'no-preference',
});
const base = process.env.MOBILE_URL ?? 'http://localhost:8179';
await page.addInitScript(authenticatedSessionFixture);
// Observe rendered frames, rather than asserting animation implementation details.
await page.addInitScript(() => {
  window.homeMotionFrames = [];
  const sample = () => {
    const row = document.querySelector('[data-testid="home-schedule-row"]');
    const greeting = document.querySelector('[data-testid="app-header"]')
      ?.children[1];
    const check = document.querySelector('[role="checkbox"] > div');
    window.homeMotionFrames.push({
      rowY: row ? new DOMMatrix(getComputedStyle(row).transform).m42 : null,
      greetingY: greeting
        ? new DOMMatrix(getComputedStyle(greeting).transform).m42
        : null,
      checkScale: check
        ? new DOMMatrix(getComputedStyle(check).transform).a
        : null,
    });
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
});
let writeReady, notifyWrite;
const prepareWrite = () => {
  writeReady = new Promise((resolve) => {
    notifyWrite = resolve;
  });
};
let completed = false,
  fail = false,
  release;
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
const todo = () => ({
  id: 1,
  planName: '그림책 읽기',
  scheduledDate: new Date().toLocaleDateString('en-CA'),
  scheduledTime: '09:00:00',
  completed,
});
await page.route('**/api/v1/todos**', async (r) => {
  if (r.request().method() === 'PUT') {
    await new Promise((resolve) => {
      release = resolve;
      notifyWrite();
    });
    if (fail) return r.fulfill({ status: 500, json: {} });
    completed = !completed;
    return r.fulfill({ json: todo() });
  }
  await r.fulfill({ json: [todo()] });
});
const scale = (locator) =>
  locator.evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return m.a;
  });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(`${base}/main`, { timeout: 120000 });
  const input = page.getByRole('textbox', {
    name: '홈 질문 입력',
    exact: true,
  });
  const send = page.getByRole('button', {
    name: '질문 이어서 보내기',
    exact: true,
  });
  await input.waitFor();
  await page.getByTestId('home-schedule-row').waitFor();
  await page.waitForTimeout(450);
  const entranceFrames = await page.evaluate(() => window.homeMotionFrames);
  assert(
    entranceFrames.some((f) => f.rowY > 0 && f.rowY < 8),
    'First list display must have intermediate entrance frames',
  );
  assert(
    entranceFrames.some((f) => f.greetingY > 0 && f.greetingY < 8),
    'Greeting must enter once',
  );
  assert.equal(await send.isDisabled(), true);
  const surface = input.locator('..');
  const initial = await surface.boundingBox();
  await input.fill('그림책을 같이 읽고 싶어요');
  await page.waitForTimeout(350);
  assert.equal(await send.isDisabled(), false);
  const focused = await surface.boundingBox();
  assert(
    Math.abs(initial.height - focused.height) < 1,
    'Focus must not resize the input surface',
  );
  const box = await send.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(160);
  assert(
    (await scale(send)) < 0.99,
    'Send press must visibly scale without changing its touch target',
  );
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await page.waitForTimeout(500);
  assert(
    Math.abs((await scale(send)) - 1) < 0.005,
    'Release/cancel must settle',
  );
  assert.equal(new URL(page.url()).pathname, '/main');
  assert.equal(await input.inputValue(), '그림책을 같이 읽고 싶어요');
  await page.getByRole('button', { name: '놀이 추천', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '작성 중인 질문' }).waitFor();
  assert.equal(await input.inputValue(), '그림책을 같이 읽고 싶어요');
  const check = page.getByRole('checkbox', {
    name: '그림책 읽기 완료',
    exact: true,
  });
  prepareWrite();
  await check.click();
  await Promise.race([
    writeReady,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Completion request was not received')),
        5000,
      ),
    ),
  ]);
  assert.equal(
    await check.isDisabled(),
    true,
    'Pending control must be disabled',
  );
  assert.equal(
    await check.getAttribute('aria-checked'),
    'false',
    'Pending must not claim completion',
  );
  assert.equal(
    await page.getByRole('progressbar').getAttribute('aria-valuenow'),
    '0',
  );
  await page.evaluate(() => {
    window.homeMotionFrames = [];
  });
  release();
  await page.getByText('완료 1개 / 전체 1개', { exact: true }).waitFor();
  assert.equal(
    await page.getByRole('progressbar').getAttribute('aria-valuenow'),
    '100',
  );
  await page.waitForTimeout(500);
  const completionFrames = await page.evaluate(() => window.homeMotionFrames);
  assert(
    completionFrames.some((f) => f.checkScale > 1.01),
    'Confirmed completion must pulse the check',
  );
  await page.evaluate(() => {
    window.homeMotionFrames = [];
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(80);
  const row = page.getByTestId('home-schedule-row');
  assert.equal(
    await row.evaluate(
      (el) => new DOMMatrix(getComputedStyle(el).transform).m42,
    ),
    0,
    'Refetch must not replay entrance',
  );
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await page.waitForTimeout(450);
  const returnFrames = await page.evaluate(() => window.homeMotionFrames);
  assert(
    returnFrames.filter((f) => f.rowY !== null).every((f) => f.rowY === 0),
    'Refetch/tab return must not replay list entrance',
  );
  assert(
    returnFrames
      .filter((f) => f.greetingY !== null)
      .every((f) => f.greetingY === 0),
    'Refetch/tab return must not replay greeting',
  );
  fail = true;
  prepareWrite();
  await page
    .getByRole('checkbox', { name: '그림책 읽기 완료 취소', exact: true })
    .click();
  await Promise.race([
    writeReady,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Completion request was not received')),
        5000,
      ),
    ),
  ]);
  release();
  await page
    .getByRole('alert')
    .filter({ hasText: '완료 상태를 저장하지 못했어요' })
    .waitFor();
  assert.equal(
    await page.getByRole('progressbar').getAttribute('aria-valuenow'),
    '100',
    'Failed storage must preserve completed state',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await input.fill('');
  await input.fill('새 질문');
  await page.waitForTimeout(100);
  const reducedBox = await send.boundingBox();
  await page.mouse.move(
    reducedBox.x + reducedBox.width / 2,
    reducedBox.y + reducedBox.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(120);
  assert.equal(
    await scale(send),
    1,
    'Live reduced motion must suppress press scaling',
  );
  await page.mouse.move(0, 0);
  await page.mouse.up();
  assert.deepEqual(errors, []);
  console.log(
    'PASS initial-only entrance, press/cancel, stable focus, draft protection, confirmed completion pulse, pending/failure, progress bounds, refetch/tab return and live reduced motion',
  );
} catch (error) {
  console.error(await page.locator('body').innerText());
  await page.screenshot({ path: '/tmp/main179-motion-failure.png' });
  throw error;
} finally {
  await browser.close();
}
