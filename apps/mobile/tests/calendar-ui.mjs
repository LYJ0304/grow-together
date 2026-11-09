import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
page.setDefaultTimeout(12000);
await page.clock.setFixedTime(new Date('2026-11-08T12:00:00'));
await page.addInitScript(() => {
  const diary = {
    date: '2026-10-31',
    content: '함께한 날의 저장된 미리보기 요약',
    emotions: [],
    growthPoints: [],
    photoUris: [],
  };
  localStorage.setItem(
    '@growtogether/diary/preview/v2/2026-10-31',
    JSON.stringify(diary),
  );
  const key = Storage.prototype.key;
  Storage.prototype.key = function (index) {
    if (window.failList) throw new Error('Unavailable');
    return key.call(this, index);
  };
});
const click = (name) => page.getByRole('button', { name, exact: true }).click();
try {
  await page.goto(
    `${process.env.CALENDAR_URL ?? 'http://localhost:8156'}/login`,
    { waitUntil: 'commit', timeout: 120000 },
  );
  await click('인증 없이 미리보기 진입');
  await page.getByRole('tab', { name: '기록', exact: true }).click();
  await page
    .getByRole('heading', { name: '2026년 11월', exact: true })
    .waitFor();
  const grid = page.getByTestId('calendar-grid');
  assert.equal(await grid.getByRole('button').count(), 35);
  await click('이전 달');
  await page
    .getByRole('heading', { name: '2026년 10월', exact: true })
    .waitFor();
  assert.equal(await grid.getByRole('button').count(), 35);
  await click('2026년 10월 31일, 일기 있음');
  await page
    .getByText('함께한 날의 저장된 미리보기 요약', { exact: true })
    .waitFor();
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  await page.getByRole('tab', { name: '기록', exact: true }).click();
  assert.equal(
    await page
      .getByRole('button', { name: '2026년 10월 31일, 일기 있음', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  await page.evaluate(() => {
    window.failList = true;
  });
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await page.getByRole('tab', { name: '기록', exact: true }).click();
  await page
    .getByRole('alert')
    .filter({ hasText: '목록을 불러오지 못했어요' })
    .waitFor();
  assert(
    await page
      .getByRole('button', { name: '선택한 날짜의 일기 보기', exact: true })
      .isDisabled(),
  );
  await page.evaluate(() => {
    window.failList = false;
  });
  await click('일기 목록 다시 불러오기');
  await click('오늘로 이동');
  await page
    .getByText('저장된 미리보기 기록이 없어요. 오늘의 순간을 남겨보세요.', {
      exact: true,
    })
    .waitFor();
  await click('선택한 날짜의 일기 작성하기');
  await page.waitForURL('**/diary**');
  await page
    .getByRole('textbox', { name: '추가 관찰 메모', exact: true })
    .fill('아직 저장하지 않은 관찰');
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  await page.getByRole('tab', { name: '기록', exact: true }).click();
  assert.equal(
    await page
      .getByRole('textbox', { name: '추가 관찰 메모', exact: true })
      .inputValue(),
    '아직 저장하지 않은 관찰',
  );
  await click('기록으로 돌아가기');
  await click('작성하던 일기 이어 쓰기');
  assert.equal(
    await page
      .getByRole('textbox', { name: '추가 관찰 메모', exact: true })
      .inputValue(),
    '아직 저장하지 않은 관찰',
  );
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  console.log(
    'PASS calendar grid, selected date/month retention, saved summary, empty/error/retry and draft entry at 320px',
  );
} finally {
  await browser.close();
}
