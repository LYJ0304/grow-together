import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
page.setDefaultTimeout(30000);
await page.addInitScript(authenticatedSessionFixture);
let writes = 0;
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
await page.route('**/api/v1/diary**', (r) => {
  writes++;
  return r.fulfill({ status: 400, json: {} });
});
try {
  await page.goto(
    (process.env.MOBILE_URL ?? 'http://localhost:8156') +
      '/diary?date=2026-10-31',
    { waitUntil: 'commit', timeout: 120000 },
  );
  await page
    .getByRole('button', { name: '직접 작성하기', exact: true })
    .click();
  const editor = page.getByRole('textbox', {
    name: '일기 본문 수정',
    exact: true,
  });
  const content = '가'.repeat(1001);
  await editor.fill(content);
  await page.getByRole('button', { name: '수정 완료', exact: true }).click();
  await page
    .getByRole('button', { name: '이 일기 저장하기', exact: true })
    .click();
  await page.getByRole('alert').filter({ hasText: '1000자' }).waitFor();
  assert.equal(writes, 0);
  await page.getByRole('button', { name: '내용 수정', exact: true }).click();
  assert.equal(await editor.inputValue(), content);
  console.log(
    'PASS server content length validation preserves input and prevents invalid writes',
  );
} finally {
  await browser.close();
}
