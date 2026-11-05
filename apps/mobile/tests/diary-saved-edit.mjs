import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const url = process.argv[2] ?? 'http://localhost:8131';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/google/chrome/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
page.setDefaultTimeout(15000);
const key = '@growtogether/diary/v1/2026-11-04';
const original = {
  date: '2026-11-04',
  content: '원래 저장된 일기',
  emotions: ['기쁨'],
  growthPoints: ['새로운 시도'],
  photoUris: [
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH9sAAAAASUVORK5CYII=',
  ],
  tomorrowTip: '그림책 읽기',
  sourceRecords: {
    activities: ['독서'],
    note: '책장을 넘겼어요.',
    tags: ['#성취/시도'],
  },
  futureMetadata: { preserve: true },
};
await page.addInitScript(authenticatedSessionFixture);
await page.addInitScript(
  ({ key, original }) => {
    if (localStorage.getItem(key) === null)
      localStorage.setItem(key, JSON.stringify(original));
  },
  { key, original },
);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const click = (name) => page.getByRole('button', { name, exact: true }).click();
const editor = () => page.getByRole('textbox', { name: '일기 본문 수정' });
const stored = () =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
try {
  await page.goto(`${url}/diary?date=2026-11-04&mode=view`);
  await page.getByText(original.content, { exact: true }).waitFor();
  await click('수정');
  assert.equal(await editor().inputValue(), original.content);
  await editor().fill('취소할 수정');
  await click('취소');
  assert.deepEqual(await stored(), original);
  await click('수정');
  await editor().fill(' ');
  assert.ok(
    await page
      .getByRole('button', { name: '변경사항 저장', exact: true })
      .isDisabled(),
  );
  await editor().fill('다듬은 일기');
  // Saving failure keeps the editor and persisted original.
  await page.evaluate(() => {
    window.profileSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('@growtogether/diary/')) throw new Error('quota');
      return window.profileSet.call(this, key, value);
    };
  });
  await click('변경사항 저장');
  await page
    .getByRole('alert')
    .filter({ hasText: '저장하지 못했어요' })
    .waitFor();
  assert.equal(await editor().inputValue(), '다듬은 일기');
  assert.deepEqual(await stored(), original);
  await page.evaluate(() => {
    Storage.prototype.setItem = window.profileSet;
  });
  // Delay a read to check duplicate submit and save/delete/navigation guards.
  await page.evaluate(() => {
    const get = Storage.prototype.getItem;
    let release;
    window.editReads = 0;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith('@growtogether/diary/')) {
        window.editReads++;
        if (!release) {
          const thenable = {
            then(resolve) {
              release = () => resolve(get.call(localStorage, key));
              window.finishEdit = release;
            },
          };
          return thenable;
        }
      }
      return get.call(this, key);
    };
    window.originalDiaryGet = get;
  });
  await click('변경사항 저장');
  const pending = page.getByRole('button', { name: '저장 중...', exact: true });
  await pending.waitFor();
  await pending.dispatchEvent('click');
  assert.ok(
    await page
      .getByRole('button', { name: '일기 삭제', exact: true })
      .isDisabled(),
  );
  assert.ok(
    await page
      .getByRole('button', { name: '뒤로가기', exact: true })
      .isDisabled(),
  );
  assert.equal(await editor().isEditable(), false);
  assert.equal(await page.evaluate(() => window.editReads), 1);
  await page.evaluate(() => {
    window.finishEdit();
    Storage.prototype.getItem = window.originalDiaryGet;
  });
  await page.getByText('다듬은 일기', { exact: true }).waitFor();
  assert.deepEqual(await stored(), { ...original, content: '다듬은 일기' });
  assert.equal(
    await page.getByRole('button', { name: /^다시 생성하기/ }).count(),
    0,
  );
  await page.reload();
  await page.getByText('다듬은 일기', { exact: true }).waitFor();
  await click('수정');
  await editor().fill('버릴 본문');
  await click('뒤로가기');
  await page.getByRole('dialog').waitFor();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '취소', exact: true })
    .click();
  assert.equal(await editor().inputValue(), '버릴 본문');
  await click('뒤로가기');
  await click('나가기');
  await page.waitForURL('**/calendar*');
  assert.deepEqual(await stored(), { ...original, content: '다듬은 일기' });
  await page.goto(`${url}/diary?date=2026-11-04&mode=view`);
  await click('수정');
  for (const width of [320, 390, 1024]) {
    await page.setViewportSize({ width, height: 820 });
    await editor().fill('긴 일기를 수정해요.\n'.repeat(60));
    const save = page.getByRole('button', {
      name: '변경사항 저장',
      exact: true,
    });
    await save.scrollIntoViewIfNeeded();
    const box = await save.boundingBox();
    assert.ok(box.height >= 44);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await click('취소');
  assert.deepEqual(await stored(), { ...original, content: '다듬은 일기' });
  await page.goto(`${url}/diary?date=2026-11-05&mode=view`);
  await page.getByText(/저장된 일기가 없어요/).waitFor();
  assert.equal(
    await page.getByRole('button', { name: '수정', exact: true }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS saved diary UI: edit/save/cancel/reload, metadata preservation, failures, pending guards, exit confirmation and responsive layout',
  );
} finally {
  await browser.close();
}
