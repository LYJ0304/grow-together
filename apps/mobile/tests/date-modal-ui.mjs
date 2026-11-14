import { editDateParts } from './date-field-fixture.mjs';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
await page.addInitScript(authenticatedSessionFixture);
let writes = [];
let empty = false;
await page.route('**/api/v1/children/me', (r) => {
  if (r.request().method() !== 'GET') writes.push(r.request().postDataJSON());
  return r.fulfill(
    empty
      ? { status: 404, json: { code: 'NOT_FOUND' } }
      : { json: { name: '하늘', birthday: '2024-02-29' } },
  );
});
try {
  await page.goto(
    `${process.env.MOBILE_URL ?? 'http://localhost:8221'}/children`,
  );
  await page.getByRole('button', { name: '수정', exact: true }).click();
  const paint = (button) =>
    button.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        background: style.backgroundColor,
        radius: style.borderRadius,
        minHeight: style.minHeight,
        text: getComputedStyle(node.querySelector('[dir="auto"]')).color,
      };
    });
  const savePaint = await paint(
    page.getByRole('button', { name: '저장', exact: true }),
  );
  const cancelPaint = await paint(
    page.getByRole('button', { name: '취소', exact: true }),
  );
  await page
    .getByRole('button', { name: '생년월일', exact: true })
    .click({ timeout: 5000 });
  const modal = page.getByRole('dialog', {
    name: '생년월일 선택',
    exact: true,
  });
  await modal.waitFor();
  assert.deepEqual(
    await paint(modal.getByRole('button', { name: '완료', exact: true })),
    savePaint,
  );
  assert.deepEqual(
    await paint(modal.getByRole('button', { name: '취소', exact: true })),
    cancelPaint,
  );
  await editDateParts(modal, '1990-03-04');
  assert.equal(
    await page
      .getByRole('button', { name: '생년월일', exact: true })
      .textContent(),
    '2024년 2월 29일',
  );
  await modal.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '생년월일', exact: true }).click();
  await modal.getByRole('radio', { name: '2024년', exact: true }).waitFor();
  await editDateParts(modal, '2024-03-04');
  await modal.getByRole('button', { name: '완료', exact: true }).click();
  await page.getByText('2024년 3월 4일', { exact: true }).waitFor();
  assert.deepEqual(writes, [], 'selection must not save to the server');
  await page.getByRole('button', { name: '생년월일', exact: true }).click();
  const yearInput = modal.getByRole('textbox', {
    name: '연도 바로 입력',
    exact: true,
  });
  await yearInput.fill('9999');
  assert.equal(
    await modal.getByRole('button', { name: '완료', exact: true }).isDisabled(),
    true,
  );
  await yearInput.fill('1900');
  await modal.getByRole('radio', { name: '1900년', exact: true }).waitFor();
  assert.equal(
    await modal
      .getByRole('radio', { name: '1900년', exact: true })
      .getAttribute('aria-checked'),
    'true',
  );
  await modal.getByRole('radio', { name: '1900년', exact: true }).focus();
  await page.keyboard.press('End');
  await modal.getByRole('radio', { name: '1년', exact: true }).waitFor();
  assert.equal(
    await modal
      .getByRole('radio', { name: '1년', exact: true })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await page.keyboard.press('Home');
  await modal
    .getByRole('radio', { name: `${new Date().getFullYear()}년`, exact: true })
    .waitFor();
  const month = modal.getByRole('radio', { name: '3월', exact: true });
  await month.focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(
    await modal
      .getByRole('radio', { name: '4월', exact: true })
      .getAttribute('aria-checked'),
    'true',
  );
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    assert.equal(
      await modal.evaluate((node) => node.contains(document.activeElement)),
      true,
      'keyboard focus stays within modal',
    );
  }
  await page.keyboard.press('Escape');
  await modal.waitFor({ state: 'hidden' });
  assert.equal(
    await page
      .getByRole('button', { name: '생년월일', exact: true })
      .evaluate((node) => node === document.activeElement),
    true,
    'focus returns to field',
  );
  await mkdir('/tmp/shared-date-ui', { recursive: true });
  for (const width of [320, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: 740 });
    await page.getByRole('button', { name: '생년월일', exact: true }).click();
    const bounds = await modal.boundingBox();
    assert(bounds.x >= 0 && bounds.x + bounds.width <= width);
    await page.screenshot({ path: `/tmp/shared-date-ui/modal-${width}.png` });
    await modal.getByRole('button', { name: '취소', exact: true }).click();
  }
  await page.setViewportSize({ width: 320, height: 580 });
  await page.getByRole('button', { name: '생년월일', exact: true }).click();
  await page.addStyleTag({
    content:
      '[dir="auto"], input { font-size:24px !important; line-height:32px !important; }',
  });
  await modal
    .getByRole('button', { name: '완료', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/shared-date-ui/large-text.png' });
  await modal.getByRole('button', { name: '취소', exact: true }).click();
  empty = true;
  await page.reload();
  await page.getByRole('button', { name: '아이 추가', exact: true }).click();
  const field = page.getByRole('button', { name: '생년월일', exact: true });
  assert.equal(await field.textContent(), '날짜 선택');
  await field.click();
  await modal.getByRole('button', { name: '취소', exact: true }).click();
  assert.equal(
    await field.textContent(),
    '날짜 선택',
    'opening a blank field must not commit today',
  );
  assert.deepEqual(writes, []);
  console.log(
    'PASS shared date modal: pending edits, cancel/restore, explicit commit, Korean display, no premature API write',
  );
} finally {
  await browser.close();
}
