import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(8000);
await page.addInitScript(authenticatedSessionFixture);
let record = {
  id: 42,
  diaryDate: '2026-11-15',
  content: '서버 기록',
  todos: [{ id: 7, planName: '책 읽기' }],
  diaryFiles: [
    { id: 1, imageUrl: 'https://images.example/a.png' },
    { id: 2, imageUrl: 'https://images.example/a.png' },
  ],
};
let writes = 0,
  fail = true,
  request;
await page.route('**/api/v1/diary**', (r) => {
  const method = r.request().method(),
    url = new URL(r.request().url());
  if (method === 'PUT') {
    writes++;
    request = r.request().postDataJSON();
    if (fail)
      return r.fulfill({ status: 400, json: { code: 'INVALID_REQUEST' } });
    record = {
      ...record,
      content: request.content,
      diaryFiles: request.diaryFiles.map((x, i) => ({ id: i + 10, ...x })),
    };
  }
  return r.fulfill({
    json: url.searchParams.has('month')
      ? [{ id: 42, diaryDate: record.diaryDate }]
      : record,
  });
});
const click = (name) => page.getByRole('button', { name, exact: true }).click();
try {
  await page.goto(
    `${process.env.MOBILE_URL ?? 'http://localhost:8262'}/diary?date=2026-11-15&mode=view&id=42`,
  );
  await page.getByText('2 / 3장', { exact: true }).waitFor();
  await click('내용 수정');
  await click('사진 1 크게 보기');
  await click('이 사진 제거');
  await click('첨부에서 빼기');
  await click('사진 닫기');
  assert.equal(
    writes,
    0,
    'removing a draft attachment does not mutate the server',
  );
  await click('취소');
  await page.getByText('2 / 3장', { exact: true }).waitFor();
  await click('내용 수정');
  await click('사진 2 크게 보기');
  await click('이 사진 제거');
  await click('첨부에서 빼기');
  await click('사진 닫기');
  await page
    .getByRole('textbox', { name: '일기 본문 수정', exact: true })
    .fill('사진을 정리한 서버 기록');
  await click('변경사항 저장');
  await page
    .getByRole('alert')
    .filter({ hasText: '입력 내용을 확인' })
    .waitFor();
  await page.getByText('1 / 3장', { exact: true }).waitFor();
  assert.equal(record.diaryFiles.length, 2);
  assert.deepEqual(request.diaryFiles, [
    { imageUrl: 'https://images.example/a.png' },
  ]);
  assert.deepEqual(request.todoIds, [7]);
  fail = false;
  await click('변경사항 저장');
  await page.waitForURL('**/calendar**');
  await click('선택한 날짜의 일기 보기');
  await page.getByText('1 / 3장', { exact: true }).waitFor();
  assert.equal(record.content, '사진을 정리한 서버 기록');
  assert.equal(writes, 2);
  await click('내용 수정');
  assert.equal(
    await page.getByRole('button', { name: '사진 추가', exact: true }).count(),
    0,
  );
  console.log(
    'PASS authenticated photo removal is deferred to save, cancel/failure preserves originals, retry restores remaining reference and activities',
  );
} finally {
  await browser.close();
}
