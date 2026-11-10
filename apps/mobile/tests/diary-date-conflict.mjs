import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.addInitScript(authenticatedSessionFixture);
let exists = false,
  posts = 0,
  puts = 0;
const date = '2026-11-11';
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
await page.route('**/api/v1/diary**', (r) => {
  const request = r.request();
  const url = new URL(request.url());
  if (request.method() === 'POST') {
    posts++;
    exists = true;
    assert.equal(request.postDataJSON().diaryDate, date);
    return r.fulfill({
      status: 409,
      json: { code: 'CONFLICT', message: 'Diary already exists' },
    });
  }
  if (request.method() === 'PUT') puts++;
  if (url.pathname.endsWith('/by-date') && !exists)
    return r.fulfill({ status: 404, json: { code: 'NOT_FOUND' } });
  return r.fulfill({
    json: {
      id: 42,
      diaryDate: date,
      content: '다른 기기의 기존 일기',
      todos: [],
      diaryFiles: [],
    },
  });
});
try {
  await page.goto(
    `${process.env.MOBILE_URL ?? 'http://localhost:8156'}/diary?date=${date}`,
    { waitUntil: 'commit', timeout: 120000 },
  );
  await page
    .getByRole('textbox', { name: '추가 관찰 메모', exact: true })
    .fill('내가 작성하던 초안');
  await page
    .getByRole('button', { name: '직접 작성하기', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: '일기 본문 수정', exact: true })
    .fill('저장 충돌에도 보존할 본문');
  await page.getByRole('button', { name: '수정 완료', exact: true }).click();
  await page
    .getByRole('button', { name: '이 일기 저장하기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '기존 일기 확인', exact: true })
    .waitFor();
  assert(
    await page.getByText('저장 충돌에도 보존할 본문', { exact: true }).count(),
  );
  assert.equal(posts, 1);
  assert.equal(puts, 0);
  await page
    .getByRole('button', { name: '기존 일기 확인', exact: true })
    .click();
  await page
    .getByText('다른 기기의 기존 일기', { exact: true })
    .last()
    .waitFor();
  assert.equal(puts, 0);
  console.log(
    'Diary date conflict passed: explicit date, 409 preserves draft, existing record opens without overwrite',
  );
} finally {
  await browser.close();
}
