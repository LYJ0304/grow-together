import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 360 } });
page.setDefaultTimeout(30000);
await page.addInitScript(authenticatedSessionFixture);
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
try {
  await page.goto(
    `${process.env.MOBILE_URL ?? 'http://localhost:8156'}/diary?date=2026-10-31`,
  );
  await page
    .getByRole('button', { name: '직접 작성하기', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: '일기 본문 수정', exact: true })
    .fill('직접 쓴 본문');
  await page.getByRole('button', { name: '수정 완료', exact: true }).click();
  await page.addStyleTag({
    content:
      '[dir="auto"] {font-size:24px !important;line-height:36px !important;}',
  });
  await page
    .getByRole('button', { name: '초안 다시 정리', exact: true })
    .click();
  for (const name of ['취소', '교체하고 다시 정리']) {
    const button = page.getByRole('button', { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    assert(
      box.y >= 0 && box.y + box.height <= 360,
      `${name} remains reachable in a short large-text panel`,
    );
  }
  console.log('PASS short large-text regeneration panel');
} finally {
  await browser.close();
}
