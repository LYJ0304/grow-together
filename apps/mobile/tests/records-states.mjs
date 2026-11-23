import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
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
page.setDefaultTimeout(12000);
let release;
let held = new Promise((resolve) => {
  release = resolve;
});
let failMonth = false,
  failDetail = false;
const details = [];
const rows = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  diaryDate: `2026-11-${String(i + 1).padStart(2, '0')}`,
  content: `기록-${String(i + 1).padStart(2, '0')} 함께 걸었던 하루`,
  todos: [],
  diaryFiles:
    i === 14 ? [{ id: 1, imageUrl: 'https://example.test/record.png' }] : [],
}));
await page.route('https://example.test/record.png', (r) =>
  r.fulfill({
    contentType: 'image/png',
    body: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD9kAAAAASUVORK5CYII=',
      'base64',
    ),
  }),
);
await page.route('**/api/v1/diary**', async (r) => {
  const u = new URL(r.request().url()),
    month = u.searchParams.get('month'),
    date = u.searchParams.get('date');
  if (month) {
    if (held) await held;
    return r.fulfill(
      failMonth
        ? { status: 500, json: {} }
        : {
            json: rows
              .filter((x) => x.diaryDate.startsWith(month))
              .map(({ id, diaryDate }) => ({ id, diaryDate })),
          },
    );
  }
  if (date) {
    details.push(date);
    return r.fulfill(
      failDetail
        ? { status: 500, json: {} }
        : { json: rows.find((x) => x.diaryDate === date) },
    );
  }
  return r.fulfill({
    json: rows.find((x) => x.id === Number(u.pathname.split('/').at(-1))),
  });
});
const click = (name) => page.getByRole('button', { name, exact: true }).click();
try {
  await page.goto(
    `${process.env.MOBILE_URL ?? 'http://localhost:8251'}/calendar`,
  );
  await page.getByText('기록을 불러오는 중이에요.', { exact: true }).waitFor();
  assert.equal(
    await page.getByText('이날의 기록이 아직 없어요', { exact: true }).count(),
    0,
  );
  held = null;
  release();
  await page.getByText('기록-15 함께 걸었던 하루', { exact: true }).waitFor();
  const photo = page.getByTestId('record-card-2026-11-15').locator('img');
  await photo.waitFor();
  assert.equal((await photo.boundingBox()).width, 72);
  assert.deepEqual([...new Set(details)], ['2026-11-15']);
  await page
    .getByRole('button', { name: /2026년 11월 30일.*일기 있음/ })
    .click();
  await page.getByText('기록-30 함께 걸었던 하루', { exact: true }).waitFor();
  assert(details.length < 6, 'only selected dates fetch details');
  failMonth = true;
  await click('다음 달');
  await click('다음 달');
  await page
    .getByRole('alert')
    .filter({ hasText: '일기 목록을 불러오지 못했어요.' })
    .waitFor();
  assert.equal(
    await page.getByText('이날의 기록이 아직 없어요', { exact: true }).count(),
    0,
  );
  failMonth = false;
  await click('일기 목록 다시 불러오기');
  await page.getByText('이날의 기록이 아직 없어요', { exact: true }).waitFor();
  failDetail = true;
  await click('오늘로 이동');
  // Returning to the tab refreshes visible detail without presenting an empty record.
  await page.getByRole('tab', { name: '상담', exact: true }).click();
  await page.getByRole('tab', { name: '캘린더', exact: true }).click();
  await page
    .getByRole('alert')
    .filter({ hasText: '기록 내용을 불러오지 못했어요.' })
    .waitFor();
  assert.equal(
    await page.getByText('이날의 기록이 아직 없어요', { exact: true }).count(),
    0,
  );
  failDetail = false;
  await click('기록 다시 불러오기');
  await page.getByText('기록-15 함께 걸었던 하루', { exact: true }).waitFor();
  await page.setViewportSize({ width: 320, height: 580 });
  await page.addStyleTag({
    content:
      '[dir="auto"]{font-size:24px!important;line-height:36px!important;}',
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: '/tmp/records-browser/large-text.png' });
  console.log(
    'PASS record loading/empty/error separation, real photo/no-photo, selected-date fetching, content failure/retry and large text',
  );
} catch (error) {
  console.log('details', details);
  console.log(
    await page.getByTestId('records-list').evaluate((node) => ({
      tag: node.tagName,
      top: node.scrollTop,
      height: node.scrollHeight,
      client: node.clientHeight,
      overflow: getComputedStyle(node).overflowY,
      children: [...node.querySelectorAll('[data-testid^=record-card]')].map(
        (n) => ({ id: n.dataset.testid, y: n.getBoundingClientRect().y }),
      ),
    })),
  );
  await page.screenshot({ path: '/tmp/records-browser/failure.png' });
  throw error;
} finally {
  release?.();
  await browser.close();
}
