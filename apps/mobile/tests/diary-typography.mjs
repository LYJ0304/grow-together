import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';

const url = process.argv[2] ?? 'http://localhost:8095';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
await page.addInitScript(authenticatedSessionFixture);
const click = (name) => page.getByRole('button', { name, exact: true }).click();
const textStyle = (locator) =>
  locator.evaluate((node) => {
    const style = getComputedStyle(node);
    return [
      style.fontFamily,
      style.fontSize,
      style.lineHeight,
      style.fontWeight,
    ];
  });
const buttonText = (name) =>
  page
    .getByRole('button', { name, exact: true })
    .getByText(name, { exact: true });
async function fits() {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
}
try {
  await page.goto(`${url}/diary?date=2026-10-12&mode=create`);
  const heading = page.getByRole('heading', { name: 'AI 육아 일기 생성' });
  await heading.waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => document.fonts.check('24px Jua')));
  assert.match((await textStyle(heading))[0], /Jua/);
  const next = await textStyle(buttonText('다음으로'));
  assert.doesNotMatch(
    next[0],
    /Jua/,
    'Controls use the body font, not the display font',
  );
  assert.deepEqual(next.slice(1), ['16px', '24px', '600']);
  await click('다음으로');
  const section = page.getByRole('heading', { name: '오늘의 성장 한 줄 기록' });
  const sectionStyle = await textStyle(section);
  assert.match(sectionStyle[0], /Jua/);
  assert.deepEqual(sectionStyle.slice(1), ['19px', '28px', '400']);
  assert.deepEqual(await textStyle(buttonText('일기 생성하기')), next);
  const note = page.getByRole('textbox', { name: '오늘의 성장 한 줄 기록' });
  await note.fill('숟가락을 직접 잡았어요.');
  const body = await textStyle(note);
  assert.deepEqual(body.slice(1), ['16px', '27px', '400']);
  assert.doesNotMatch(body[0], /Jua/);
  await page.screenshot({ path: '/tmp/issue-149-diary-notes.png' });
  await click('일기 생성하기');
  const resultHeading = page.getByRole('heading', {
    name: '오늘의 일기',
    exact: true,
  });
  await resultHeading.waitFor();
  assert.deepEqual(await textStyle(resultHeading), sectionStyle);
  const result = page
    .getByText('숟가락을 직접 잡았어요.', { exact: false })
    .filter({ hasNot: page.locator('textarea') })
    .first();
  assert.deepEqual(await textStyle(result), body);
  assert.deepEqual(await textStyle(buttonText('이 일기 저장하기')), next);
  await page.screenshot({ path: '/tmp/issue-149-diary-result.png' });
  await click('수정');
  const editor = page.getByRole('textbox', { name: '일기 본문 수정' });
  assert.deepEqual(await textStyle(editor), body);
  await editor.fill('긴 기록도 편안하게 읽고 수정해요.\n'.repeat(30));
  await page.waitForFunction(() => {
    const input = document.querySelector(
      'textarea[aria-label="일기 본문 수정"]',
    );
    return input && input.scrollHeight <= input.clientHeight + 1;
  });
  await click('수정 완료');
  await page.getByRole('button', { name: /^다시 생성하기,/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const dialogTitle = dialog.getByText('수정한 일기를 다시 생성할까요?', {
    exact: true,
  });
  assert.deepEqual(await textStyle(dialogTitle), sectionStyle);
  assert.deepEqual(
    await textStyle(dialog.getByText('다시 생성', { exact: true })),
    next,
  );
  await click('취소');
  await click('이 일기 저장하기');
  await page.waitForURL('**/calendar*');
  await page.goto(`${url}/diary?date=2026-10-12&mode=view`);
  await page.getByRole('button', { name: '수정', exact: true }).waitFor();
  assert.deepEqual(
    await textStyle(
      page.getByRole('heading', { name: '오늘의 일기', exact: true }),
    ),
    sectionStyle,
  );
  await click('수정');
  assert.deepEqual(await textStyle(editor), body);
  await click('취소');
  await click('일기 삭제');
  await page.getByRole('dialog').waitFor();
  assert.deepEqual(
    await textStyle(
      page.getByRole('dialog').getByText('삭제', { exact: true }),
    ),
    next,
  );
  await click('취소');
  for (const width of [320, 375, 393, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 820 });
    await fits();
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addStyleTag({
    content:
      '[dir="auto"], textarea { font-size: 24px !important; line-height: 36px !important; }',
  });
  await click('수정');
  await editor.focus();
  // Reduced viewport exercises the web editor with an on-screen keyboard-sized area.
  await page.setViewportSize({ width: 320, height: 400 });
  await editor.fill('작은 화면에서도 긴 본문을 수정해요.\n'.repeat(40));
  await page.waitForFunction(() => {
    const input = document.querySelector(
      'textarea[aria-label="일기 본문 수정"]',
    );
    return input && input.scrollHeight <= input.clientHeight + 1;
  });
  await fits();
  const complete = page.getByRole('button', {
    name: '변경사항 저장',
    exact: true,
  });
  await complete.scrollIntoViewIfNeeded();
  const completeBox = await complete.boundingBox();
  assert(
    completeBox.height >= 44 &&
      completeBox.y >= 0 &&
      completeBox.y + completeBox.height <= 400,
  );
  await click('취소');
  await page.setViewportSize({ width: 320, height: 568 });
  await click('일기 삭제');
  const deleteButton = page.getByRole('button', { name: '삭제', exact: true });
  await deleteButton.scrollIntoViewIfNeeded();
  await fits();
  const deleteBox = await deleteButton.boundingBox();
  assert(
    deleteBox.height >= 44 &&
      deleteBox.y >= 0 &&
      deleteBox.y + deleteBox.height <= 568,
  );
  await click('취소');
  console.log(
    'PASS diary role typography, loaded Jua, reading/editing parity, saved view, dialogs and narrow layout',
  );
} finally {
  await browser.close();
}
