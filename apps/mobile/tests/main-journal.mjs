import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  timezoneId: 'Asia/Seoul',
  reducedMotion: 'reduce',
});
await page.addInitScript(authenticatedSessionFixture);
await page.clock.setFixedTime(new Date('2026-11-12T12:00:00+09:00'));
const base = process.env.MOBILE_URL ?? 'http://localhost:8195';
let failDiary = false;
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/todos**', (r) =>
  r.fulfill({
    json: [
      {
        id: 1,
        planName: '책 읽기',
        scheduledDate: new URL(r.request().url()).searchParams.get('date'),
        scheduledTime: '09:00:00',
        completed: true,
      },
    ],
  }),
);
await page.route('**/api/v1/diary**', (r) =>
  failDiary
    ? r.fulfill({ status: 500, json: {} })
    : new URL(r.request().url()).searchParams.get('date') === '2026-11-11' ||
        new URL(r.request().url()).pathname.endsWith('/8')
      ? r.fulfill({
          json: {
            id: 8,
            diaryDate: '2026-11-11',
            content: '책을 읽었다',
            todos: [],
            diaryFiles: [
              { id: 9, imageUrl: 'https://example.invalid/photo.jpg' },
            ],
          },
        })
      : r.fulfill({ status: 404, json: { code: 'NOT_FOUND' } }),
);
try {
  await page.goto(base + '/main');
  await page.getByRole('heading', { name: '오늘', exact: true }).waitFor();
  await page.getByRole('button', { name: '일기 0개', exact: true }).waitFor();
  assert(
    await page
      .getByRole('button', { name: '다음 날', exact: true })
      .isDisabled(),
  );
  assert.equal(
    await page.getByRole('textbox', { name: '홈 질문 입력' }).count(),
    0,
  );
  await page.getByRole('button', { name: '이전 날', exact: true }).click();
  await page.getByRole('button', { name: '일기 1개', exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: '이날 이야기 나누기', exact: true })
      .count(),
    1,
    'Past dates must not be described as today',
  );
  assert.equal(
    await page
      .getByRole('progressbar', { name: '선택한 날 일정 완료율', exact: true })
      .count(),
    1,
  );
  await page
    .getByRole('button', {
      name: '일기와 사진, 일기 1개 · 사진 1장',
      exact: true,
    })
    .waitFor();
  await page
    .getByRole('button', { name: '선택한 날 일기 열기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '하루의 순간 기록하기', exact: true })
    .click();
  await page.waitForURL('**/diary?**');
  assert.equal(new URL(page.url()).searchParams.get('id'), '8');
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await page.getByRole('button', { name: '다음 날', exact: true }).click();
  await page.getByRole('button', { name: '일기 0개', exact: true }).waitFor();
  for (const [width, height] of [
    [320, 700],
    [390, 844],
    [844, 390],
    [1024, 900],
  ]) {
    await page.setViewportSize({ width, height });
    const fab = await page
      .getByRole('button', { name: '선택한 날 일기 작성하기' })
      .boundingBox();
    const nav = await page.getByRole('tablist').boundingBox();
    assert(
      fab.y + fab.height < nav.y,
      'Floating create button stays above navigation',
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.getByTestId('home-day-heading').evaluate(async (node) => {
      let parent = node.parentElement;
      while (parent) {
        parent.scrollTop = 0;
        parent = parent.parentElement;
      }
      window.scrollTo(0, 0);
      await new Promise(requestAnimationFrame);
    });
    await page.screenshot({ path: `/tmp/journal-main-${width}.png` });
  }
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  const draft = page.getByRole('textbox', {
    name: '상담 질문 입력',
    exact: true,
  });
  await draft.fill('기존 질문을 유지해요');
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await page
    .getByRole('button', { name: '오늘 이야기 나누기', exact: true })
    .click();
  assert.equal(await draft.inputValue(), '기존 질문을 유지해요');
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await page.getByRole('button', { name: '선택한 날 일기 작성하기' }).click();
  await page
    .getByRole('button', { name: '하루의 순간 기록하기', exact: true })
    .click();
  await page.waitForURL('**/diary?**');
  assert(new URL(page.url()).searchParams.get('date') === '2026-11-12');
  assert.equal(
    new URL(page.url()).searchParams.get('id'),
    null,
    'A different date must not reuse the previously opened diary ID',
  );
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  failDiary = true;
  await page.getByRole('button', { name: '이전 날', exact: true }).click();
  await page.getByRole('button', { name: '이전 날', exact: true }).click();
  await page
    .getByRole('button', { name: '일기 다시 확인', exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole('button', { name: '일기 0개', exact: true }).count(),
    0,
    'Failure is not zero records',
  );
  console.log(
    'PASS journal home structure, real counts, date navigation, error distinction, draft retention, FAB route and responsive bounds',
  );
} finally {
  await browser.close();
}
