import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
page.setDefaultTimeout(10000);
await page.addInitScript(authenticatedSessionFixture);
let failure = true,
  writes = 0,
  last,
  held,
  release,
  savedContent,
  deleteFailure = false;
const date = '2026-10-31';
const todos = [
  {
    id: 1,
    planName: '완료한 책 읽기',
    content: '책장을 넘겼어요',
    scheduledDate: date,
    scheduledTime: '09:00:00',
    completed: true,
  },
  {
    id: 2,
    planName: '아직 안 한 산책',
    scheduledDate: date,
    scheduledTime: '10:00:00',
    completed: false,
  },
];
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: todos }));
await page.route('**/api/v1/diary**', async (r) => {
  const url = new URL(r.request().url());
  if (r.request().method() === 'GET' && url.searchParams.has('month'))
    return r.fulfill({
      json: savedContent ? [{ id: 42, diaryDate: date }] : [],
    });
  if (
    r.request().method() === 'GET' &&
    url.pathname.endsWith('/by-date') &&
    !savedContent
  )
    return r.fulfill({ status: 404, json: { code: 'NOT_FOUND' } });
  if (r.request().method() === 'GET')
    return r.fulfill({
      json: {
        id: 42,
        diaryDate: date,
        content: savedContent,
        todos: [todos[0]],
        diaryFiles: [{ id: 7, imageUrl: 'https://images.example/child.jpg' }],
      },
    });
  if (r.request().method() === 'DELETE') {
    if (!deleteFailure) savedContent = undefined;
    return r.fulfill(
      deleteFailure ? { status: 400, json: {} } : { status: 204 },
    );
  }
  if (held) await held;
  writes++;
  last = r.request().postDataJSON();
  if (!failure) savedContent = last.content;
  return r.fulfill(
    failure
      ? { status: 400, json: { message: '다시 확인해주세요' } }
      : {
          json: {
            id: 42,
            content: last.content,
            todos: [todos[0]],
            diaryFiles: [],
          },
        },
  );
});
try {
  await page.goto(
    `${process.env.MOBILE_URL ?? 'http://localhost:8156'}/diary?date=${date}`,
    { waitUntil: 'commit', timeout: 120000 },
  );
  await page.getByRole('checkbox', { name: /완료한 책 읽기/ }).waitFor();
  assert.equal(
    await page.getByRole('checkbox', { name: /아직 안 한 산책/ }).count(),
    0,
  );
  await page.getByRole('checkbox', { name: /완료한 책 읽기/ }).click();
  await page
    .getByRole('textbox', { name: '추가 관찰 메모', exact: true })
    .fill('책장을 보며 웃었어요');
  await page
    .getByRole('button', { name: '직접 작성하기', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: '일기 본문 수정', exact: true })
    .fill('내가 다듬은 오늘의 기록');
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  await page.getByRole('tab', { name: '기록', exact: true }).click();
  // A mounted records stack resumes its editor immediately after a tab round trip.
  await page
    .getByRole('textbox', { name: '일기 본문 수정', exact: true })
    .waitFor();
  await page
    .getByRole('button', { name: '기록으로 돌아가기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '작성하던 일기 이어 쓰기', exact: true })
    .click();
  assert.equal(
    await page
      .getByRole('textbox', { name: '일기 본문 수정', exact: true })
      .inputValue(),
    '내가 다듬은 오늘의 기록',
  );
  await page.getByRole('button', { name: '수정 완료', exact: true }).click();
  await page
    .getByRole('button', { name: '초안 다시 정리', exact: true })
    .click();
  await page
    .getByRole('heading', {
      name: '수정한 본문을 새 초안으로 바꿀까요?',
      exact: true,
    })
    .waitFor();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByText('내가 다듬은 오늘의 기록', { exact: true }).waitFor();
  held = new Promise((resolve) => {
    release = resolve;
  });
  await page
    .getByRole('button', { name: '이 일기 저장하기', exact: true })
    .click();
  await page.getByRole('button', { name: '저장 중…', exact: true }).waitFor();
  assert(
    await page.getByRole('tab', { name: '질문', exact: true }).isDisabled(),
    'Navigation is disabled while saving',
  );
  const blockedTab = page.getByRole('tab', { name: '질문', exact: true });
  assert.equal(
    await blockedTab.getAttribute('href'),
    null,
    'Saving removes web navigation targets',
  );
  const savingUrl = page.url();
  await blockedTab.evaluate((node) => node.click());
  assert.equal(
    page.url(),
    savingUrl,
    'Disabled tab clicks cannot leave an ongoing save',
  );
  held = undefined;
  release();
  await page.getByRole('alert').waitFor();
  assert.equal(writes, 1);
  assert.equal(last.content, '내가 다듬은 오늘의 기록');
  assert.equal(last.diaryDate, date);
  assert.deepEqual(last.todoIds, [1]);
  failure = false;
  await page
    .getByRole('button', { name: '이 일기 저장하기', exact: true })
    .click();
  await page.waitForURL('**/calendar**');
  assert.equal(writes, 2);
  await page
    .getByRole('button', { name: '선택한 날짜의 일기 보기', exact: true })
    .click();
  await page.waitForURL('**/diary**');
  await page
    .getByText('내가 다듬은 오늘의 기록', { exact: true })
    .last()
    .waitFor();
  await page.getByRole('button', { name: '내용 수정', exact: true }).click();
  const editor = page.getByRole('textbox', {
    name: '일기 본문 수정',
    exact: true,
  });
  await editor.fill('저장된 본문을 다시 다듬었어요');
  failure = true;
  await page
    .getByRole('button', { name: '변경사항 저장', exact: true })
    .click();
  await page.getByRole('alert').waitFor();
  assert.equal(await editor.inputValue(), '저장된 본문을 다시 다듬었어요');
  assert.deepEqual(last.todoIds, [1]);
  assert.deepEqual(last.diaryFiles, [
    { imageUrl: 'https://images.example/child.jpg' },
  ]);
  failure = false;
  await page
    .getByRole('button', { name: '변경사항 저장', exact: true })
    .click();
  await page.waitForURL('**/calendar**');
  await page
    .getByRole('button', { name: '선택한 날짜의 일기 보기', exact: true })
    .click();
  await page
    .getByText('저장된 본문을 다시 다듬었어요', { exact: true })
    .last()
    .waitFor();
  await page.getByRole('button', { name: '일기 삭제', exact: true }).click();
  deleteFailure = true;
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await page.getByRole('alert').last().waitFor();
  deleteFailure = false;
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await page.waitForURL('**/calendar**');
  await page
    .getByRole('button', { name: '선택한 날짜의 일기 작성하기', exact: true })
    .click();
  assert.equal(
    await page
      .getByRole('textbox', { name: '추가 관찰 메모', exact: true })
      .inputValue(),
    '',
    'Saved/deleted draft does not reappear as a new draft',
  );
  console.log(
    'PASS live edit metadata preservation, edit/delete failure and retry, draft cleanup; actual completed materials, manual editing, tab draft preservation, API save failure and retry',
  );
} finally {
  await browser.close();
}
