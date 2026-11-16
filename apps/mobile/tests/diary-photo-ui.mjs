import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(10000);
await mkdir('/tmp/diary-compose-shots', { recursive: true });
await page.clock.setFixedTime(new Date('2026-11-15T12:00:00+09:00'));
let apiCalls = 0;
await page.route('**/api/v1/diary**', (r) => {
  apiCalls++;
  return r.fulfill({ status: 500, json: {} });
});
await page.addInitScript(() => {
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (window.failSave && key.startsWith('@growtogether/diary/preview/'))
      throw Error('quota');
    return original.call(this, key, value);
  };
});
const click = (name) => page.getByRole('button', { name, exact: true }).click();
try {
  await page.goto(`${process.env.MOBILE_URL ?? 'http://localhost:8261'}/login`);
  await click('인증 없이 미리보기 진입');
  await page.getByRole('tab', { name: '기록', exact: true }).click();
  await click('선택한 날짜의 일기 작성하기');
  const body = page.getByRole('textbox', { name: '일기 본문', exact: true });
  await body.fill('사진과 함께 남기는 기록');
  const files = [];
  for (const color of ['red', 'blue', 'green', 'orange']) {
    const encoded = await page.evaluate((color) => {
      const c = document.createElement('canvas');
      c.width = 40;
      c.height = 20;
      const x = c.getContext('2d');
      x.fillStyle = color;
      x.fillRect(0, 0, 40, 20);
      return c.toDataURL('image/png').split(',')[1];
    }, color);
    files.push({
      name: `${color}.png`,
      mimeType: 'image/png',
      buffer: Buffer.from(encoded, 'base64'),
    });
  }
  const pick = async (items) => {
    const event = page.waitForEvent('filechooser');
    await click('사진 추가');
    await (await event).setFiles(items);
  };
  await pick([files[0]]);
  await page.getByText('1 / 3장', { exact: true }).waitFor();
  // Browser cancellation must leave the existing attachment unchanged.
  const cancel = page.waitForEvent('filechooser');
  await click('사진 추가');
  await cancel;
  await page.locator('input[type=file]').last().dispatchEvent('cancel');
  await page
    .getByRole('button', { name: '사진 추가', exact: true })
    .waitFor({ state: 'visible' });
  await pick([
    {
      name: 'bad.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>',
      ),
    },
  ]);
  await page.getByRole('alert').filter({ hasText: '10MB 이하' }).waitFor();
  await page.getByText('1 / 3장', { exact: true }).waitFor();
  await pick([files[0], files[1]]);
  await page.getByText('2 / 3장', { exact: true }).waitFor();
  await pick([files[2], files[3]]);
  await page.getByText('3 / 3장', { exact: true }).waitFor();
  assert.equal(
    await page.getByRole('button', { name: '사진 추가', exact: true }).count(),
    0,
  );
  await click('사진 1 크게 보기');
  await page.getByRole('img', { name: '사진 원본 1', exact: true }).waitFor();
  await click('다음 사진');
  await page.getByRole('img', { name: '사진 원본 2', exact: true }).waitFor();
  await click('이전 사진');
  await click('이 사진 제거');
  await click('사진 유지');
  await click('사진 닫기');
  await click('사진 2 크게 보기');
  await click('이 사진 제거');
  await click('첨부에서 빼기');
  await click('사진 닫기');
  await page.getByText('2 / 3장', { exact: true }).waitFor();
  await click('사진 1 크게 보기');
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: '사진 닫기', exact: true })
    .waitFor({ state: 'hidden' });
  await page.screenshot({
    path: '/tmp/diary-compose-shots/composer.png',
    fullPage: true,
  });
  await page.evaluate(() => {
    window.failSave = true;
  });
  await click('일기 저장하기');
  await page
    .getByRole('alert')
    .filter({ hasText: '저장하지 못했어요' })
    .waitFor();
  assert.equal(await body.inputValue(), '사진과 함께 남기는 기록');
  await page.getByText('2 / 3장', { exact: true }).waitFor();
  await page.evaluate(() => {
    window.failSave = false;
  });
  await click('일기 저장하기');
  await page.waitForURL('**/calendar**');
  await click('선택한 날짜의 일기 보기');
  await page
    .getByText('사진과 함께 남기는 기록', { exact: true })
    .last()
    .waitFor();
  await page
    .getByRole('img', { name: '일기 사진 1, 총 2장', exact: true })
    .waitFor();
  await click('내용 수정');
  const editor = page.getByRole('textbox', {
    name: '일기 본문 수정',
    exact: true,
  });
  await editor.fill('본문만 수정한 기록');
  await click('변경사항 저장');
  await page.waitForURL('**/calendar**');
  await click('선택한 날짜의 일기 보기');
  await click('내용 수정');
  for (let left = 2; left > 0; left--) {
    await click('사진 1 크게 보기');
    await click('이 사진 제거');
    await click('첨부에서 빼기');
    if (left > 1) await click('사진 닫기');
  }
  await page.getByText('0 / 3장', { exact: true }).waitFor();
  await pick([files[2]]);
  await page.getByText('1 / 3장', { exact: true }).waitFor();
  await click('변경사항 저장');
  await page.waitForURL('**/calendar**');
  await click('선택한 날짜의 일기 보기');
  await page
    .getByRole('img', { name: '일기 사진 1, 총 1장', exact: true })
    .waitFor();
  assert.equal(apiCalls, 0, 'preview never writes diary API');
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 720 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await click('사진 1 크게 보기');
  await page.setViewportSize({ width: 320, height: 360 });
  await page.addStyleTag({
    content:
      '[dir="auto"] {font-size:22px !important;line-height:32px !important;}',
  });
  const closeButton = page.getByRole('button', {
    name: '사진 닫기',
    exact: true,
  });
  await closeButton.scrollIntoViewIfNeeded();
  const closeBox = await closeButton.boundingBox();
  assert(closeBox.y >= 0 && closeBox.y + closeBox.height <= 360);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await mkdir('/tmp/diary-compose-shots', { recursive: true });
  await page.screenshot({
    path: '/tmp/diary-compose-shots/saved.png',
    fullPage: true,
  });
  await click('내용 수정');
  await pick([files[1]]);
  await page.getByText('2 / 3장', { exact: true }).waitFor();
  await click('내 프로필 열기');
  await click('미리보기 종료');
  await click('인증 없이 미리보기 진입');
  await page.getByRole('tab', { name: '기록', exact: true }).click();
  await click('선택한 날짜의 일기 보기');
  await page.getByText('1 / 3장', { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: '사진 2 크게 보기', exact: true })
      .count(),
    0,
    'unsaved photo draft is cleared at session transition',
  );
  console.log(
    'PASS actual preview file selection, append/dedupe/cancel/limit, photo viewer/navigation/ESC/delete, failed save retention, saved photo restore/body edit/removal and responsive layout',
  );
} catch (error) {
  console.log((await page.locator('body').innerText()).slice(-2500));
  throw error;
} finally {
  await browser.close();
}
