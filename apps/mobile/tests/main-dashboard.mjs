import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  timezoneId: 'Asia/Seoul',
  reducedMotion: 'reduce',
  hasTouch: true,
});
page.setDefaultTimeout(8000);
await page.clock.setFixedTime(new Date('2026-11-14T12:00:00+09:00'));
await page.addInitScript(authenticatedSessionFixture);
const reads = { todos: [], diary: [] };
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/todos**', (r) => {
  const date = new URL(r.request().url()).searchParams.get('date');
  reads.todos.push(date);
  return r.fulfill({
    json: Array.from({ length: 4 }, (_, i) => ({
      id: i + 1,
      planName: `활동 ${i + 1}`,
      scheduledDate: date,
      scheduledTime: `${String(8 + i).padStart(2, '0')}:00:00`,
      completed: i === 3,
    })),
  });
});
await page.route('**/api/v1/diary**', (r) => {
  const date = new URL(r.request().url()).searchParams.get('date');
  if (date) reads.diary.push(date);
  return date === '2026-11-13' || r.request().url().endsWith('/81')
    ? r.fulfill({
        json: {
          id: 81,
          diaryDate: '2026-11-13',
          content: '하루의 기록',
          todos: [],
          diaryFiles: [],
        },
      })
    : r.fulfill({ status: 404, json: { code: 'NOT_FOUND' } });
});
const click = (name) => page.getByRole('button', { name, exact: true }).click();
const selected = (name) =>
  page.getByRole('button', { name, exact: true }).getAttribute('aria-pressed');
try {
  await mkdir('/tmp/main-dashboard', { recursive: true });
  await page.goto(`${process.env.MOBILE_URL ?? 'http://localhost:8240'}/main`);
  await page
    .getByRole('heading', { name: '2026년 11월', exact: true })
    .waitFor();
  assert.equal(
    await page.getByTestId('home-week-calendar').getByRole('button').count(),
    7,
  );
  assert.equal(await selected('2026년 11월 14일, 오늘'), 'true');
  await page.getByRole('button', { name: '일정 4개', exact: true }).waitFor();
  assert.equal(await page.getByTestId('home-schedule-row').count(), 3);
  const rows = await page.getByTestId('home-schedule-row').allTextContents();
  assert(
    rows[0].includes('활동 1') &&
      rows[1].includes('활동 2') &&
      rows[2].includes('활동 3'),
  );
  assert.equal(
    await page
      .getByRole('heading', { name: '하루의 순간', exact: true })
      .count(),
    0,
  );
  const summary = await page.getByTestId('home-summary').boundingBox();
  assert(summary.height >= 72 && summary.height <= 88);
  const activity = await page
    .getByRole('heading', { name: '오늘의 활동', exact: true })
    .boundingBox();
  assert(
    activity.y < 600,
    'activity section must start in the first mobile viewport',
  );
  const diary = await page
    .getByRole('button', { name: '오늘의 순간 기록하기', exact: true })
    .boundingBox();
  assert(activity.y < diary.y);
  await click('2026년 11월 13일');
  await page
    .getByRole('button', { name: '이날의 기록 보기', exact: true })
    .waitFor();
  assert.equal(reads.todos.at(-1), '2026-11-13');
  assert.equal(reads.diary.at(-1), '2026-11-13');
  await click('이날의 기록 보기');
  await page.waitForURL('**/diary?**');
  assert.equal(new URL(page.url()).searchParams.get('id'), '81');
  assert.equal(new URL(page.url()).searchParams.get('mode'), 'view');
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await click('다음 주');
  assert.equal(await selected('2026년 11월 20일'), 'true');
  await page
    .getByRole('button', { name: '이날의 활동 계획하기', exact: true })
    .waitFor();
  await page.getByText('08:00 · 예정', { exact: true }).waitFor();
  await click('선택한 날 활동 추가하기');
  assert(
    await page
      .getByRole('button', { name: '하루의 순간 기록하기', exact: true })
      .isDisabled(),
  );
  await click('닫기');
  await click('이날의 활동 계획하기');
  await page.waitForURL('**/todo?**');
  assert.equal(new URL(page.url()).pathname, '/todo');
  await page.getByRole('heading', { name: '계획 추가', exact: true }).waitFor();
  await page.getByText('2026년 11월 20일', { exact: true }).waitFor();
  await click('계획 추가 닫기');
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await click('오늘로 돌아가기');
  await click('날짜 선택');
  const modal = page.getByRole('dialog', { name: '날짜 선택', exact: true });
  await page.screenshot({ path: '/tmp/main-dashboard/date-picker.png' });
  await modal.getByRole('button', { name: '다음 달', exact: true }).click();
  await modal
    .getByRole('button', { name: '2026년 12월 1일', exact: true })
    .click();
  assert.equal(await selected('2026년 12월 1일'), 'true');
  await click('이전 주');
  assert.equal(await selected('2026년 11월 24일'), 'true');
  await click('날짜 선택');
  await modal.getByRole('button', { name: '이전 달', exact: true }).click();
  await modal.getByRole('button', { name: '취소', exact: true }).click();
  assert.equal(await selected('2026년 11월 24일'), 'true');
  await click('날짜 선택');
  await page.keyboard.press('Escape');
  await modal.waitFor({ state: 'hidden' });
  assert.equal(await selected('2026년 11월 24일'), 'true');
  await click('오늘로 돌아가기');
  await mkdir('/tmp/main-dashboard', { recursive: true });
  for (const width of [320, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    const cells = await page
      .getByTestId('home-week-calendar')
      .getByRole('button')
      .all();
    for (const cell of cells) {
      const b = await cell.boundingBox();
      assert(b.width >= 44 && b.height >= 44);
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.getByTestId('home-week-calendar').evaluate((node) => {
      let p = node;
      while (p) {
        p.scrollTop = 0;
        p = p.parentElement;
      }
    });
    await page.screenshot({ path: `/tmp/main-dashboard/after-${width}.png` });
  }
  await click('2026년 11월 10일');
  await page.clock.setSystemTime(new Date('2026-11-15T12:00:00+09:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page
    .getByRole('button', { name: '2026년 11월 15일, 오늘', exact: true })
    .waitFor();
  assert.equal(
    await selected('2026년 11월 10일'),
    'true',
    'midnight/foreground must preserve explicit past selection',
  );
  assert.equal(reads.todos.at(-1), '2026-11-10');
  await page.setViewportSize({ width: 320, height: 580 });
  await page.addStyleTag({
    content:
      '[dir="auto"] {font-size:24px !important; line-height:36px !important;}',
  });
  await page.getByTestId('home-week-calendar').scrollIntoViewIfNeeded();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: '/tmp/main-dashboard/after-large.png' });
  console.log(
    'PASS main dashboard week/month selection, date queries, real diary ID, future planning, compact hierarchy and responsive targets',
  );
} finally {
  await browser.close();
}
