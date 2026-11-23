import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    timezoneId: 'Asia/Seoul',
  });
  page.setDefaultTimeout(8000);
  await page.clock.setFixedTime(new Date('2026-11-23T12:00:00+09:00'));
  await page.addInitScript(authenticatedSessionFixture);
  const activity = (date) => ({
    id: 1,
    planName: '그림책 읽기',
    scheduledDate: date,
    scheduledTime: '10:00:00',
    completed: true,
  });
  const diary = (date) => ({
    id: 2,
    diaryDate: date,
    content: '책을 보며 웃었던 날',
    todos: date.endsWith('23') ? [activity(date)] : [],
    diaryFiles: [],
  });
  await page.route('**/api/v1/todos**', (route) => {
    const url = new URL(route.request().url());
    const date = url.searchParams.get('date');
    return route.fulfill({
      json: url.pathname.endsWith('/month')
        ? url.searchParams.get('month') === '2026-11'
          ? ['2026-11-23', '2026-11-24']
          : []
        : date && /2026-11-(23|24)/.test(date)
          ? [activity(date)]
          : [],
    });
  });
  const base = process.env.MOBILE_URL ?? 'http://localhost:8195';
  const fileId = '6e2fa5ee-db2c-4de4-b068-404c1c65ebac';
  let failedUpload = true;
  const saved = new Map();
  await page.route('**/api/files/presigned-url', (route) =>
    route.fulfill({
      status: 201,
      json: { fileId, uploadUrl: base + '/mock-diary-upload' },
    }),
  );
  await page.route('**/mock-diary-upload', (route) =>
    route.fulfill({ status: failedUpload ? 500 : 200 }),
  );
  await page.route(`**/api/files/${fileId}/complete`, (route) =>
    route.fulfill({ json: { id: fileId, status: 'COMPLETED' } }),
  );
  await page.route('**/api/v1/diary**', (route) => {
    const url = new URL(route.request().url());
    const date = url.searchParams.get('date');
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON();
      const record = {
        ...diary(input.diaryDate),
        content: input.content,
        todos: input.todoIds.map(() => activity(input.diaryDate)),
      };
      assert.deepEqual(input.diaryFiles, [{ fileId }]);
      saved.set(input.diaryDate, record);
      return route.fulfill({ status: 201, json: record });
    }
    if (saved.has(date)) return route.fulfill({ json: saved.get(date) });
    if (date)
      return /2026-11-(23|25)/.test(date)
        ? route.fulfill({ json: diary(date) })
        : route.fulfill({ status: 404, json: {} });
    return route.fulfill({
      json: [
        ...(url.searchParams.get('month') === '2026-11'
          ? ['2026-11-23', '2026-11-25'].map(diary)
          : []),
        ...[...saved.values()].filter((record) =>
          record.diaryDate.startsWith(url.searchParams.get('month') ?? '?'),
        ),
      ],
    });
  });

  await page.goto(base + '/calendar');
  await page.getByRole('heading', { name: '우리의 하루' }).waitFor();
  const tabs = page.getByRole('tablist').getByRole('tab');
  assert.deepEqual(
    await tabs.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('aria-label')),
    ),
    ['홈', '캘린더', '상담', '마이'],
  );
  const day = (number, markers) =>
    page.getByRole('button', {
      name: new RegExp(`2026년 11월 ${number}일.*${markers}`),
    });
  await day(23, '일정 있음.*일기 있음').waitFor();
  await page.getByRole('button', { name: '그림책 읽기 메뉴' }).waitFor();
  await page.getByText('책을 보며 웃었던 날', { exact: true }).waitFor();
  await day(24, '일정 있음').click();
  await page.getByRole('button', { name: '그림책 읽기 메뉴' }).waitFor();
  await page.getByText('이날의 기록이 아직 없어요').waitFor();
  await day(25, '일기 있음').click();
  await page.getByText('등록된 일정이 없어요.').waitFor();
  await page.getByText('책을 보며 웃었던 날', { exact: true }).waitFor();
  await page.getByRole('button', { name: '일정', exact: true }).click();
  assert.equal(
    await page.getByText('책을 보며 웃었던 날', { exact: true }).count(),
    0,
  );
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await page.getByRole('button', { name: '이전 달' }).click();
  await page.getByText('2026년 10월', { exact: true }).waitFor();
  await page
    .getByRole('button', { name: '선택한 날짜의 일기 작성하기' })
    .click();
  await page.waitForURL(/\/diary.*date=2026-10-25/);
  await page.getByRole('button', { name: '일기 날짜 변경' }).waitFor();
  const body = page.getByRole('textbox', { name: '일기 본문' });
  await body.fill('지난달 함께했던 하루');
  await page.getByRole('button', { name: '일기 날짜 변경' }).click();
  const datePicker = page.getByRole('dialog', { name: '일기 날짜 선택' });
  await datePicker.getByRole('radio', { name: '24일', exact: true }).click();
  await datePicker.getByRole('button', { name: '완료', exact: true }).click();
  assert.equal(await body.inputValue(), '지난달 함께했던 하루');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    canvas.getContext('2d').fillRect(0, 0, 20, 20);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '사진 추가' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'diary.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await page.getByText('1 / 3장', { exact: true }).waitFor();
  const save = page.getByRole('button', { name: '일기 저장하기' });
  await save.click();
  await page.getByText(/사진을 업로드하지 못했어요/).waitFor();
  assert.equal(await body.inputValue(), '지난달 함께했던 하루');
  await page.getByText('1 / 3장', { exact: true }).waitFor();
  assert.equal(saved.size, 0);
  failedUpload = false;
  await save.click();
  await page.waitForURL(/\/calendar/);
  await page.getByText('지난달 함께했던 하루', { exact: true }).waitFor();
  assert.equal(saved.get('2026-10-24').content, '지난달 함께했던 하루');
  await page.goto(base + '/calendar?date=2026-11-24');
  await page.getByRole('button', { name: '그림책 읽기 메뉴' }).click();
  await page.getByRole('button', { name: '이 활동을 일기로 남기기' }).click();
  await page.waitForURL(/\/diary.*todoId=1/);
  assert.equal(
    await page
      .getByRole('checkbox', { name: /그림책 읽기/ })
      .getAttribute('aria-checked'),
    'true',
  );
  await page.goto(base + '/todo?date=2026-11-24&add=true');
  await page.waitForURL(/\/calendar/);
  await page.getByText('계획 추가', { exact: true }).waitFor();
  console.log(
    'Unified calendar tabs, mixed markers, day filters, month navigation photo retry, save/refresh, schedule-to-diary linking and legacy entry passed.',
  );
} finally {
  await browser.close();
}
