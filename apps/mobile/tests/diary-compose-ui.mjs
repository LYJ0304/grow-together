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
await page.route('**/api/v1/diary**', (r) =>
  r.fulfill({ status: 404, json: { code: 'NOT_FOUND' } }),
);
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
try {
  await page.goto(
    `${process.env.MOBILE_URL ?? 'http://localhost:8260'}/diary?date=2026-11-15`,
  );
  const body = page.getByRole('textbox', { name: '일기 본문', exact: true });
  await body.waitFor();
  assert(
    (await body.boundingBox()).y < 500,
    'body is visible without a preliminary step',
  );
  await body.fill('함께 웃었던 날\n오늘의 작은 순간');
  await page.getByRole('button', { name: '문장 정리', exact: true }).click();
  await page
    .getByRole('button', { name: '입력한 기록으로 문장 정리', exact: true })
    .click();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  assert.equal(await body.inputValue(), '함께 웃었던 날\n오늘의 작은 순간');
  assert.equal(
    await page.getByRole('button', { name: '사진 추가', exact: true }).count(),
    1,
  );
  await page
    .getByText(
      '사진은 일기를 저장할 때 업로드돼요. 최대 3장까지 첨부할 수 있어요.',
      { exact: true },
    )
    .waitFor();
  await page
    .getByRole('button', { name: '함께한 활동 선택', exact: true })
    .click();
  await page
    .getByText('완료한 일정이 없어요. 본문만으로 작성해도 괜찮아요.', {
      exact: true,
    })
    .waitFor();
  console.log(
    'PASS body-first composer, one text source, confirmed local composition, completed activities and authenticated photo attachment',
  );
} finally {
  await browser.close();
}
