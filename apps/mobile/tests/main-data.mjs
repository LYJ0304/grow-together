import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 320, height: 700 },
  timezoneId: 'Asia/Seoul',
});
page.setDefaultTimeout(12000);
await page.addInitScript(authenticatedSessionFixture);
await page.clock.install({ time: new Date('2026-10-31T23:50:00+09:00') });
let failure = false,
  empty = false,
  hold,
  release;
const reads = [];
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2026-10-01' } }),
);
await page.route('**/api/v1/todos**', async (r) => {
  assert.match(r.request().headers().authorization, /^Bearer /);
  const date = new URL(r.request().url()).searchParams.get('date');
  reads.push(date);
  if (hold) await hold;
  if (failure) return r.fulfill({ status: 500, json: {} });
  return r.fulfill({
    json:
      empty || date !== '2026-10-31'
        ? []
        : [
            {
              id: 1,
              planName: '책 읽기',
              scheduledDate: date,
              scheduledTime: '09:00:00',
              completed: false,
            },
            {
              id: 2,
              planName: '산책',
              scheduledDate: date,
              scheduledTime: '10:00:00',
              completed: true,
            },
          ],
  });
});
const text = (value) => page.getByText(value, { exact: true });
const click = (name) => page.getByRole('button', { name, exact: true }).click();
try {
  hold = new Promise((resolve) => {
    release = resolve;
  });
  await page.goto(`${process.env.MAIN_URL ?? 'http://localhost:8156'}/main`, {
    waitUntil: 'commit',
    timeout: 120000,
  });
  await text('일정을 불러오고 있어요.').waitFor();
  hold = undefined;
  release();
  await text('완료 1개 / 전체 2개').waitFor();
  await text('09:00 · 시간이 지난 미완료 일정').waitFor();
  await page
    .getByRole('heading', { name: '오늘의 일정', exact: true })
    .waitFor();
  const progress = page.getByRole('progressbar', { name: '오늘 일정 완료율' });
  assert.equal(await progress.getAttribute('aria-valuenow'), '50');
  assert.equal(
    await page
      .getByRole('heading', { name: '다음에 할 활동', exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole('heading', { name: '오늘 일정 요약', exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole('button', { name: '일기 작성하기', exact: true })
      .count(),
    0,
  );
  failure = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await text('일정을 불러오지 못했어요.').waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: '일정 만들기', exact: true })
      .count(),
    0,
    'Failure is not empty',
  );
  failure = false;
  empty = true;
  await click('일정 다시 불러오기');
  await page
    .getByRole('button', { name: '일정 만들기', exact: true })
    .waitFor();
  // The date heading can render before the query's request effect runs.
  const midnightRead = page.waitForResponse(
    (response) =>
      new URL(response.url()).searchParams.get('date') === '2026-11-01',
  );
  await page.clock.fastForward(601000);
  await midnightRead;
  await text('2026년 11월 1일 일요일').waitFor();
  assert.equal(reads.at(-1), '2026-11-01');
  const foregroundRead = page.waitForResponse(
    (response) =>
      new URL(response.url()).searchParams.get('date') === '2026-11-02',
  );
  await page.clock.setSystemTime(new Date('2026-11-02T12:00:00+09:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await text('2026년 11월 2일 월요일').waitFor();
  await foregroundRead;
  assert.equal(reads.at(-1), '2026-11-02');
  console.log(
    'PASS home loading, integrated schedule/progress, removed duplicate cards, error/empty distinction and midnight/foreground refresh',
  );
} finally {
  await browser.close();
}
