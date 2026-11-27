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
page.setDefaultTimeout(30000);
page.setDefaultNavigationTimeout(120000);
await page.addInitScript(authenticatedSessionFixture);
await page.clock.setFixedTime(new Date('2026-11-12T12:00:00+09:00'));
const base = process.env.MOBILE_URL ?? 'http://localhost:8195';
let failDiary = false;
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
await page.route('**/api/v1/diary**', (r) =>
  failDiary
    ? r.fulfill({ status: 500, json: {} })
    : r.fulfill({
        json: {
          id: 8,
          diaryDate: '2026-11-12',
          content: '책을 읽었다',
          todos: [],
          diaryFiles: [],
        },
      }),
);
const tab = (name) => page.getByRole('tab', { name, exact: true }).click();
try {
  await page.goto(base + '/main');
  await page.getByRole('button', { name: '일기 1개', exact: true }).waitFor();
  await page
    .getByRole('button', { name: '오늘의 기록 보기', exact: true })
    .click();
  await page.waitForURL('**/diary?**');
  assert.equal(new URL(page.url()).searchParams.get('id'), '8');
  assert.equal(new URL(page.url()).searchParams.get('date'), '2026-11-12');
  assert.equal(new URL(page.url()).searchParams.get('mode'), 'view');
  await tab('홈');
  await tab('상담');
  const input = page.getByRole('textbox', {
    name: '상담 질문 입력',
    exact: true,
  });
  await input.fill('기존 질문을 유지해요');
  await tab('홈');
  await page
    .getByRole('button', { name: '오늘 이야기 나누기', exact: true })
    .click();
  assert.equal(await input.inputValue(), '기존 질문을 유지해요');
  await tab('홈');
  failDiary = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page
    .getByRole('alert')
    .filter({ hasText: '일기를 불러오지 못했어요.' })
    .waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: '오늘의 기록 보기', exact: true })
      .count(),
    1,
    'cached diary target remains accurate on refetch failure',
  );
  assert.equal(await page.getByTestId('metric-skeleton-2').count(), 0);
  console.log(
    'PASS home diary date/ID routing, cached failure distinction and chat draft retention',
  );
} finally {
  await browser.close();
}
