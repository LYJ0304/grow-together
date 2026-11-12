import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
  timezoneId: 'Asia/Seoul',
});
page.setDefaultTimeout(10000);
await page.addInitScript(authenticatedSessionFixture);
await page.clock.setFixedTime(new Date('2026-11-12T12:00:00+09:00'));
let readsFail = false,
  writes = 0;
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '보람', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/todos**', (r) => {
  if (r.request().method() !== 'GET') writes++;
  return r.fulfill({ json: [] });
});
await page.route('**/api/v1/diary**', (r) => {
  if (r.request().method() !== 'GET') writes++;
  const url = new URL(r.request().url());
  if (readsFail) return r.fulfill({ status: 500, json: {} });
  if (url.searchParams.has('month'))
    return r.fulfill({
      json: [
        { id: 8, diaryDate: '2026-11-11' },
        { id: 9, diaryDate: '2026-11-10' },
      ],
    });
  return r.fulfill({ status: 404, json: { code: 'NOT_FOUND' } });
});
const base = process.env.MOBILE_URL ?? 'http://localhost:8197';
try {
  await page.goto(base + '/main');
  if (!process.env.RECORDS_ONLY) {
    await page.getByRole('button', { name: '선택한 날 일기 작성하기' }).click();
    assert.equal(
      await page
        .getByRole('heading', { name: '무엇을 남길까요?', exact: true })
        .count(),
      1,
      'FAB opens a chooser instead of immediately navigating',
    );
    assert.equal(writes, 0);
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    assert(new URL(page.url()).pathname === '/main');
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute('aria-label') ===
        '선택한 날 일기 작성하기',
    );
    await page.getByRole('button', { name: '선택한 날 일기 작성하기' }).click();
    await page
      .getByRole('button', { name: '일정 직접 추가하기', exact: true })
      .click();
    await page.getByRole('textbox', { name: '계획명', exact: true }).waitFor();
    assert.equal(writes, 0, 'Opening an action does not persist');
    await page.getByRole('button', { name: '취소', exact: true }).click();
  }
  await page.getByRole('tab', { name: '기록', exact: true }).click();
  await page.getByRole('button', { name: '모아보기', exact: true }).click();
  const entry = page.getByRole('button', {
    name: '2026년 11월 11일 일기 보기',
    exact: true,
  });
  await entry.waitFor();
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  await page.getByRole('tab', { name: '기록', exact: true }).click();
  assert.equal(
    await page
      .getByRole('button', { name: '모아보기', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  await entry.click();
  await page.waitForURL('**/diary?**');
  assert.equal(new URL(page.url()).searchParams.get('date'), '2026-11-11');
  await page.getByRole('tab', { name: '기록', exact: true }).click();
  await page.getByRole('tab', { name: '기록', exact: true }).click();
  readsFail = true;
  await page.getByRole('button', { name: '이전 달', exact: true }).click();
  await page.getByRole('alert').first().waitFor();
  assert.equal(
    await page
      .getByText('이번 달에 저장된 일기가 없어요.', { exact: true })
      .count(),
    0,
    'Read failures are not empty lists',
  );
  assert.equal(writes, 0);
  console.log(
    'PASS quick actions without writes, real month list/date navigation, view persistence and error distinction',
  );
} finally {
  await browser.close();
}
