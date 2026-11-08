import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
await page.addInitScript(authenticatedSessionFixture);
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
const style = (locator) =>
  locator.evaluate((node) => {
    const s = getComputedStyle(node);
    return { font: s.fontFamily, size: s.fontSize, line: s.lineHeight };
  });
try {
  await page.goto(
    `${process.env.MOBILE_URL ?? 'http://localhost:8156'}/diary?date=2026-10-31`,
    { waitUntil: 'commit', timeout: 120000 },
  );
  const heading = page.getByRole('heading', {
    name: '오늘의 순간을 남겨요',
    exact: true,
  });
  await heading.waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.match((await style(heading)).font, /Jua/);
  const note = page.getByRole('textbox', {
    name: '추가 관찰 메모',
    exact: true,
  });
  const body = await style(note);
  assert.doesNotMatch(body.font, /Jua/);
  assert.equal(body.size, '16px');
  assert.equal(body.line, '27px');
  await note.fill('책장을 넘기며 웃었어요');
  await page
    .getByRole('button', { name: '입력한 기록으로 초안 정리', exact: true })
    .click();
  await page
    .getByRole('heading', { name: '오늘의 일기', exact: true })
    .waitFor();
  await page.getByRole('button', { name: '내용 수정', exact: true }).click();
  assert.deepEqual(
    await style(
      page.getByRole('textbox', { name: '일기 본문 수정', exact: true }),
    ),
    body,
  );
  const button = page.getByRole('button', { name: '수정 완료', exact: true });
  assert.doesNotMatch(
    (await style(button.locator('[dir="auto"]'))).font,
    /Jua/,
  );
  console.log('PASS display headings, readable notes/body/editor and controls');
} finally {
  await browser.close();
}
