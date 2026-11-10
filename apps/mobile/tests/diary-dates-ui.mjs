import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
page.setDefaultTimeout(12000);
await page.addInitScript(authenticatedSessionFixture);
await page.clock.setFixedTime(new Date('2026-11-10T12:00:00'));
let failMonth = false;
const requests = [];
await page.route('**/api/v1/diary**', (r) => {
  const url = new URL(r.request().url());
  requests.push(url.pathname + url.search);
  if (url.searchParams.has('month'))
    return r.fulfill(
      failMonth
        ? { status: 500, json: { message: 'unavailable' } }
        : { json: [{ id: 42, diaryDate: '2026-11-10' }] },
    );
  return r.fulfill({
    json: {
      id: 42,
      diaryDate: '2026-11-10',
      content: '다른 기기에서 저장한 일기',
      todos: [],
      diaryFiles: [],
    },
  });
});
try {
  await page.goto(
    `${process.env.MOBILE_URL ?? 'http://localhost:8156'}/calendar`,
    { waitUntil: 'commit', timeout: 120000 },
  );
  await page
    .getByRole('button', {
      name: '2026년 11월 10일, 오늘, 일기 있음',
      exact: true,
    })
    .waitFor();
  await page.getByText('다른 기기에서 저장한 일기', { exact: true }).waitFor();
  assert(requests.includes('/api/v1/diary?month=2026-11'));
  assert(requests.includes('/api/v1/diary/by-date?date=2026-11-10'));
  await page.reload({ waitUntil: 'commit', timeout: 120000 });
  await page
    .getByRole('button', {
      name: '2026년 11월 10일, 오늘, 일기 있음',
      exact: true,
    })
    .waitFor();
  failMonth = true;
  await page.getByRole('button', { name: '다음 달', exact: true }).click();
  await page
    .getByRole('button', { name: '일기 목록 다시 불러오기', exact: true })
    .waitFor();
  assert(
    await page
      .getByRole('button', { name: /선택한 날짜의 일기/, exact: false })
      .isDisabled(),
  );
  console.log(
    'Diary date UI passed: server month/date, reload restoration, failed month blocks actions',
  );
} finally {
  await browser.close();
}
