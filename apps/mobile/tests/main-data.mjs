import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';

const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 320, height: 700 },
  timezoneId: 'Asia/Seoul',
});
await context.addInitScript(authenticatedSessionFixture);
const page = await context.newPage();
await page.clock.install({ time: new Date('2026-10-31T23:50:00+09:00') });
page.setDefaultTimeout(15000);
const url = process.env.MAIN_URL ?? 'http://localhost:8098';
const records = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  planName: `일정 ${i + 1}`,
  scheduledDate: '2026-10-31',
  scheduledTime: `${String(i + 8).padStart(2, '0')}:00:00`,
  completed: i >= 4,
}));
let failure = false;
let writeFailure = false;
let holdRead;
let holdWrite;
let writes = 0;
const reads = [];
await page.route('**/api/v1/children/me', (route) =>
  route.fulfill({ json: { name: '하늘', birthday: '2026-10-01' } }),
);
await page.route('**/api/v1/todos**', async (route) => {
  const request = route.request();
  const target = new URL(request.url());
  const token = request.headers().authorization;
  assert.ok(token?.startsWith('Bearer '));
  assert.equal(
    JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub,
    '1',
  );
  if (request.method() === 'GET') {
    reads.push(target.searchParams.get('date'));
    if (holdRead) await holdRead;
    if (failure)
      return route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR' } });
    return route.fulfill({
      json: records.filter(
        (r) => r.scheduledDate === target.searchParams.get('date'),
      ),
    });
  }
  assert.equal(request.method(), 'PUT');
  assert.match(target.pathname, /\/\d+\/completion$/);
  writes++;
  if (holdWrite) await holdWrite;
  if (writeFailure)
    return route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR' } });
  const record = records.find(
    (r) => r.id === Number(target.pathname.split('/').at(-2)),
  );
  record.completed = request.postDataJSON().completed;
  return route.fulfill({ json: record });
});
const progress = page.getByRole('progressbar', { name: '오늘의 루틴' });
const text = (value) => page.getByText(value, { exact: true });
const button = (name) => page.getByRole('button', { name, exact: true });
async function percent(value) {
  await page.waitForFunction(
    (expected) =>
      document
        .querySelector('[role="progressbar"]')
        ?.getAttribute('aria-valuenow') === String(expected),
    value,
  );
  assert.equal(await progress.getAttribute('aria-valuetext'), `${value}퍼센트`);
  const source = await page
    .getByTestId('routine-ring')
    .locator('img')
    .getAttribute('src');
  const svg = decodeURIComponent(source.split(',')[1]);
  if (value === 0) assert.ok(!svg.includes('stroke-dasharray'));
  else
    assert.ok(
      svg.includes(
        `stroke-dasharray="${(value / 100) * (2 * Math.PI * 90)} ${2 * Math.PI * 90}"`,
      ),
    );
}
async function home() {
  await page.getByRole('tab', { name: '홈', exact: true }).click();
  await page.waitForURL('**/main');
}
try {
  let release;
  holdRead = new Promise((resolve) => {
    release = resolve;
  });
  await page.goto(`${url}/main`);
  await text('일정을 불러오고 있어요.').waitFor();
  assert.equal(await progress.count(), 0);
  holdRead = undefined;
  release();
  await percent(33);
  for (const i of [1, 2, 3, 4]) await text(`일정 ${i}`).waitFor();
  assert.equal(await text('일정 5').count(), 0);
  assert.equal(await text('일정 6').count(), 0);
  assert.equal(reads[0], '2026-10-31');
  await button('전체 보기 →').click();
  await page.waitForURL('**/todo');
  const check = page.getByRole('checkbox', { name: '일정 1 완료' });
  holdWrite = new Promise((resolve) => {
    release = resolve;
  });
  await check.click();
  assert.equal(await check.getAttribute('aria-disabled'), 'true');
  assert.equal(await check.getAttribute('aria-checked'), 'false');
  holdWrite = undefined;
  release();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[role="checkbox"][aria-label="일정 1 완료 취소"]')
        ?.getAttribute('aria-checked') === 'true',
  );
  assert.equal(writes, 1);
  await home();
  await percent(50);
  await button('전체 보기 →').click();
  writeFailure = true;
  await page.getByRole('checkbox', { name: '일정 1 완료 취소' }).click();
  await text(
    '완료 상태를 저장하지 못했어요. 목록 새로고침으로 상태를 확인한 뒤 다시 시도해 주세요.',
  ).waitFor();
  assert.equal(
    await page
      .getByRole('checkbox', { name: '일정 1 완료 취소' })
      .getAttribute('aria-checked'),
    'true',
  );
  writeFailure = false;
  await page.getByRole('checkbox', { name: '일정 1 완료 취소' }).click();
  await page
    .getByRole('checkbox', { name: '일정 1 완료', exact: true })
    .waitFor();
  await home();
  await percent(33);
  failure = true;
  await page.reload();
  await text('일정을 불러오지 못했어요.').waitFor();
  assert.equal(await progress.count(), 0);
  failure = false;
  await button('다시 시도').click();
  await percent(33);
  records.forEach((r) => {
    r.completed = true;
  });
  // Foreground refresh must also work on web.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await percent(100);
  records.forEach((r) => {
    r.completed = false;
  });
  await page.getByRole('tab', { name: '투두', exact: true }).click();
  await home();
  await percent(0);
  await page.clock.fastForward(601000);
  await text('등록된 일정이 없어요.').waitFor();
  await percent(0);
  assert.equal(reads.at(-1), '2026-11-01');
  await page.clock.setSystemTime(new Date('2026-11-02T12:00:00+09:00'));
  const resumedRead = page.waitForRequest(
    (request) =>
      new URL(request.url()).searchParams.get('date') === '2026-11-02',
  );
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await resumedRead;
  await page.waitForFunction(
    () =>
      document
        .querySelector('[role="progressbar"]')
        ?.getAttribute('aria-valuenow') === '0',
  );
  assert.equal(reads.at(-1), '2026-11-02');
  console.log(
    'PASS main data: loading, full-list ratio/ring, preview limit, completion persistence/errors, shared cache, foreground and midnight',
  );
} finally {
  await browser.close();
}
