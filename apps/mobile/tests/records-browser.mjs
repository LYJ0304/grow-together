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
});
await page.clock.setFixedTime(new Date('2026-11-15T12:00:00+09:00'));
await page.addInitScript(authenticatedSessionFixture);
page.setDefaultTimeout(8000);
const monthReads = [],
  detailReads = [];
let failMonth = false,
  failDetail = false;
const records = new Map([
  [
    '2026-11-15',
    {
      id: 15,
      diaryDate: '2026-11-15',
      content: '햇살 아래 함께 걸었던 날',
      todos: [],
      diaryFiles: [],
    },
  ],
  [
    '2026-11-12',
    {
      id: 12,
      diaryDate: '2026-11-12',
      content: '책 속 그림을 찾아보았어요',
      todos: [],
      diaryFiles: [],
    },
  ],
  [
    '2026-10-31',
    {
      id: 31,
      diaryDate: '2026-10-31',
      content: '시월의 마지막 추억',
      todos: [],
      diaryFiles: [],
    },
  ],
]);
await page.route('**/api/v1/diary**', (r) => {
  const u = new URL(r.request().url()),
    month = u.searchParams.get('month'),
    date = u.searchParams.get('date');
  if (month) {
    monthReads.push(month);
    return r.fulfill(
      failMonth
        ? { status: 500, json: {} }
        : {
            json: [...records.values()]
              .filter((x) => x.diaryDate.startsWith(month))
              .map(({ id, diaryDate }) => ({ id, diaryDate })),
          },
    );
  }
  if (date) {
    detailReads.push(date);
    return r.fulfill(
      failDetail
        ? { status: 500, json: {} }
        : records.has(date)
          ? { json: records.get(date) }
          : { status: 404, json: { code: 'NOT_FOUND' } },
    );
  }
  const id = Number(u.pathname.split('/').at(-1));
  return r.fulfill({ json: [...records.values()].find((x) => x.id === id) });
});
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
try {
  await page.goto(
    `${process.env.MOBILE_URL ?? 'http://localhost:8242'}/calendar`,
  );
  await page.getByTestId('records-week-calendar').waitFor();
  assert.equal(
    await page.getByTestId('records-week-calendar').getByRole('button').count(),
    7,
  );
  await page.getByText('햇살 아래 함께 걸었던 날', { exact: true }).waitFor();
  const card = await page.getByTestId('record-card-2026-11-15').boundingBox();
  assert(
    card.y + card.height < 740,
    'first record is visible before scrolling',
  );
  assert.equal(
    await page
      .getByRole('button', {
        name: '2026년 11월 15일, 오늘, 일기 있음',
        exact: true,
      })
      .getAttribute('aria-pressed'),
    'true',
  );
  await page.getByRole('button', { name: '모아보기', exact: true }).click();
  await page.getByText('책 속 그림을 찾아보았어요', { exact: true }).waitFor();
  const cards = await page
    .getByTestId('records-list')
    .getByRole('button', { name: /일기 보기$/ })
    .allTextContents();
  assert(cards[0].includes('15일') && cards[1].includes('12일'));
  const before = monthReads.length;
  const detailsBefore = detailReads.length;
  await page.getByRole('button', { name: '캘린더', exact: true }).click();
  await page.getByRole('button', { name: '모아보기', exact: true }).click();
  assert.equal(
    monthReads.length,
    before,
    'mode switching reuses the month index',
  );
  assert.equal(
    detailReads.length,
    detailsBefore,
    'mode switching reuses record detail',
  );
  await page
    .getByRole('button', { name: '2026년 11월 12일 일기 보기', exact: true })
    .click();
  await page.waitForURL('**/diary?**');
  assert.equal(new URL(page.url()).searchParams.get('date'), '2026-11-12');
  assert.equal(new URL(page.url()).searchParams.get('mode'), 'view');
  await page.goBack();
  await page.getByRole('button', { name: '모아보기', exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: '모아보기', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  await page.getByRole('button', { name: '캘린더', exact: true }).click();
  await page
    .getByRole('button', { name: '월간 캘린더 펼치기', exact: true })
    .click();
  await page.getByTestId('calendar-grid').waitFor();
  await page
    .getByRole('button', { name: '2026년 11월 10일', exact: true })
    .click();
  assert.equal(await page.getByTestId('calendar-grid').count(), 0);
  await page.getByText('이날의 기록이 아직 없어요', { exact: true }).waitFor();
  await page.getByRole('button', { name: '이전 주', exact: true }).click();
  await page.getByRole('button', { name: '이전 주', exact: true }).click();
  assert(
    monthReads.includes('2026-10'),
    'cross-month week loads both marker scopes',
  );
  await page.getByRole('button', { name: '오늘로 이동', exact: true }).click();
  await page.getByText('햇살 아래 함께 걸었던 날', { exact: true }).waitFor();
  await mkdir('/tmp/records-browser', { recursive: true });
  for (const width of [320, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    for (const cell of await page
      .getByTestId('records-week-calendar')
      .getByRole('button')
      .all()) {
      const b = await cell.boundingBox();
      assert(b.width >= 44 && b.height >= 44);
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `/tmp/records-browser/calendar-${width}.png`,
    });
  }
  console.log(
    'PASS compact records calendar, month expansion/collapse, same-record cards, chronological monthly list, cache reuse, date routes and responsive touch targets',
  );
} finally {
  await browser.close();
}
