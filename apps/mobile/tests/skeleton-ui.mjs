import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const base = process.env.MOBILE_URL ?? 'http://localhost:8246';
const date = '2026-11-15';
const todo = {
  id: 1,
  planName: '그림책 읽기',
  scheduledDate: date,
  scheduledTime: '10:00:00',
  completed: false,
};
const diary = {
  id: 1,
  diaryDate: date,
  content: '함께 그림책을 읽었어요',
  todos: [],
  diaryFiles: [],
};
const gate = () => {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release };
};
async function setup() {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    timezoneId: 'Asia/Seoul',
    reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(120000);
  await page.addInitScript(authenticatedSessionFixture);
  await page.clock.setFixedTime(new Date(date + 'T12:00:00+09:00'));
  return page;
}
await mkdir('/tmp/246-skeleton-shots', { recursive: true });
try {
  const page = await setup();
  let child = gate(),
    todos = gate(),
    detail = gate(),
    fail = false;
  await page.route('**/api/v1/children/me', async (r) => {
    if (child) await child.promise;
    await r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } });
  });
  await page.route('**/api/v1/todos**', async (r) => {
    if (todos) await todos.promise;
    await r.fulfill(fail ? { status: 500, json: {} } : { json: [todo] });
  });
  await page.route('**/api/v1/diary**', async (r) => {
    if (detail) await detail.promise;
    await r.fulfill({ json: diary });
  });
  await page.goto(base + '/main');
  await page.getByTestId('profile-skeleton').waitFor();
  await page.getByTestId('schedule-skeleton').waitFor();
  assert.equal(await page.getByTestId('metric-skeleton-2').count(), 1);
  assert.equal(
    await page
      .getByRole('button', { name: '오늘의 순간 기록하기', exact: true })
      .count(),
    0,
  );
  const skeleton = page.getByTestId('schedule-skeleton');
  assert.equal(await skeleton.getAttribute('aria-busy'), 'true');
  assert.equal(await skeleton.getByRole('button').count(), 0);
  for (const width of [320, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `/tmp/246-skeleton-shots/home-${width}.png`,
    });
  }
  child.release();
  child = null;
  await page.getByRole('heading', { name: /하늘의 하루/ }).waitFor();
  assert.equal(await page.getByTestId('profile-skeleton').count(), 0);
  assert.equal(await page.getByTestId('schedule-skeleton').count(), 1);
  detail.release();
  detail = null;
  await page.getByRole('button', { name: '일기 1개', exact: true }).waitFor();
  todos.release();
  todos = null;
  await page.getByText('그림책 읽기', { exact: true }).waitFor();
  todos = gate();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByText('그림책 읽기', { exact: true }).waitFor();
  assert.equal(await page.getByTestId('schedule-skeleton').count(), 0);
  fail = true;
  todos.release();
  todos = null;
  await page
    .getByRole('alert')
    .filter({ hasText: '일정을 불러오지 못했어요.' })
    .waitFor();
  assert.equal(await page.getByText('그림책 읽기', { exact: true }).count(), 1);
  assert.equal(await page.getByRole('progressbar').count(), 1);
  fail = false;
  await page
    .getByRole('button', { name: '일정 다시 불러오기', exact: true })
    .click();
  await page.close();
  const calendar = await setup();
  let month = gate(),
    record = gate(),
    schedule = gate();
  await calendar.route('**/api/v1/children/me', (r) =>
    r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
  );
  await calendar.route('**/api/v1/todos**', async (r) => {
    const u = new URL(r.request().url());
    if (u.searchParams.has('month')) return r.fulfill({ json: [] });
    if (schedule) await schedule.promise;
    return r.fulfill({ json: [] });
  });
  await calendar.route('**/api/v1/diary**', async (r) => {
    const u = new URL(r.request().url());
    if (u.searchParams.has('month')) {
      if (month) await month.promise;
      return r.fulfill({ json: [diary] });
    }
    const selected = u.searchParams.get('date');
    if (selected === date) {
      if (record) await record.promise;
      return r.fulfill({ json: diary });
    }
    return r.fulfill({ status: 404, json: {} });
  });
  await calendar.goto(base + '/calendar');
  await calendar.getByTestId('record-index-skeleton').waitFor();
  await calendar
    .getByTestId('records-list')
    .getByTestId('schedule-skeleton')
    .waitFor();
  assert.equal(await calendar.getByTestId('calendar-grid').count(), 1);
  assert.equal(
    await calendar
      .getByText('이날의 기록이 아직 없어요', { exact: true })
      .count(),
    0,
  );
  month.release();
  month = null;
  await calendar.getByTestId('record-detail-skeleton-' + date).waitFor();
  assert.equal(await calendar.getByTestId('record-index-skeleton').count(), 0);
  record.release();
  record = null;
  schedule.release();
  schedule = null;
  await calendar.getByText(diary.content, { exact: true }).waitFor();
  await calendar.getByRole('button', { name: /2026년 11월 14일/ }).click();
  await calendar
    .getByText('이날의 기록이 아직 없어요', { exact: true })
    .waitFor();
  assert.equal(
    await calendar.getByText(diary.content, { exact: true }).count(),
    0,
    'previous date content is not reused',
  );
  await calendar.getByRole('button', { name: /2026년 11월 15일/ }).click();
  await calendar.getByText(diary.content, { exact: true }).waitFor();
  assert.equal(
    await calendar.getByTestId('record-detail-skeleton-' + date).count(),
    0,
    'cached detail stays visible',
  );
  await calendar.screenshot({ path: '/tmp/246-skeleton-shots/calendar.png' });
  await calendar.close();
  console.log(
    'PASS independent skeletons, busy/no actions, responsive bounds, cached refetch/error, index/detail split and date cache isolation',
  );
} finally {
  await browser.close();
}
