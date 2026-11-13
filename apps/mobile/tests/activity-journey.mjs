import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 320, height: 568 },
  timezoneId: 'Asia/Seoul',
});
page.setDefaultTimeout(10000);
const errors = [];
page.on('console', (message) => {
  if (/cannot contain a nested|cannot be a descendant/.test(message.text()))
    errors.push(message.text());
});
await page.addInitScript(authenticatedSessionFixture);
let complete = false,
  fail = false;
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/todos**', async (r) => {
  if (r.request().method() === 'PUT') {
    if (fail) return r.fulfill({ status: 500, json: { message: '실패' } });
    complete = JSON.parse(r.request().postData()).completed;
  }
  const todo = {
    id: 1,
    planName: '책 읽기',
    content: '그림책',
    scheduledDate: new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
    }).format(new Date()),
    scheduledTime: '09:00:00',
    completed: complete,
  };
  return r.fulfill({ json: r.request().method() === 'GET' ? [todo] : todo });
});
try {
  await page.goto(
    (process.env.MOBILE_URL ?? 'http://localhost:8156') + '/main',
    { waitUntil: 'commit', timeout: 120000 },
  );
  await page
    .getByRole('heading', { name: '오늘의 일정', exact: true })
    .waitFor();
  await page.getByRole('tab', { name: '일정', exact: true }).click();
  await page
    .getByRole('checkbox', { name: '책 읽기 완료', exact: true })
    .click();
  await page
    .getByRole('heading', { name: '아이의 반응은 어땠나요?', exact: true })
    .waitFor();
  assert(complete);
  await page.getByRole('button', { name: '나중에', exact: true }).click();
  await page.getByText('완료', { exact: true }).waitFor();
  await page
    .getByRole('checkbox', { name: '책 읽기 완료 취소', exact: true })
    .click();
  assert(!complete);
  fail = true;
  await page
    .getByRole('checkbox', { name: '책 읽기 완료', exact: true })
    .click();
  await page
    .getByRole('alert')
    .filter({ hasText: '완료 상태를 저장하지 못했어요' })
    .waitFor();
  assert.equal(
    await page
      .getByRole('heading', { name: '아이의 반응은 어땠나요?', exact: true })
      .count(),
    0,
  );
  assert.deepEqual(errors, [], 'No nested interactive controls');
  console.log(
    'PASS next activity and completion success, dismiss, undo and failure',
  );
} finally {
  await browser.close();
}
