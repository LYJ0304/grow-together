import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
page.setDefaultTimeout(30000);
page.on('pageerror', (error) => console.error(error.message));
await page.clock.setFixedTime(new Date('2026-11-08T12:00:00+09:00'));
const original = {
  date: '2026-10-31',
  content: '기기에 저장한 미리보기 기록',
  photoUris: [
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9V8AAAAASUVORK5CYII=',
  ],
  emotions: ['기쁨'],
  growthPoints: ['함께 책장을 넘겼어요'],
  sourceRecords: { activities: ['책 읽기'], note: '함께 웃었어요', tags: [] },
};
await page.addInitScript((diary) => {
  localStorage.setItem(
    '@growtogether/diary/preview/v2/' + diary.date,
    JSON.stringify(diary),
  );
  localStorage.setItem(
    '@growtogether/diary/v1/2026-10-30',
    JSON.stringify({
      ...diary,
      date: '2026-10-30',
      content: '소유자 미확인 과거 기록',
    }),
  );
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (window.failWrite && key.startsWith('@growtogether/diary/preview/'))
      throw new Error('Quota');
    return set.call(this, key, value);
  };
  const remove = Storage.prototype.removeItem;
  Storage.prototype.removeItem = function (key) {
    if (window.failDelete && key.startsWith('@growtogether/diary/preview/'))
      throw new Error('Unavailable');
    return remove.call(this, key);
  };
}, original);
const click = async (name) =>
  page.getByRole('button', { name, exact: true }).click();
try {
  await page.goto(
    (process.env.MOBILE_URL ?? 'http://localhost:8156') + '/login',
    { waitUntil: 'commit', timeout: 120000 },
  );
  await click('인증 없이 미리보기 진입');
  await page.getByRole('tab', { name: '기록', exact: true }).click();
  const month = page.getByRole('heading', { name: /2026년 10월/ });
  if (!(await month.count())) await click('이전 달');
  await click('2026년 10월 31일, 일기 있음');
  await click('선택한 날짜의 일기 보기');
  await page.getByText(original.content, { exact: true }).last().waitFor();
  await page
    .getByRole('img', { name: '일기 사진 1, 총 1장', exact: true })
    .waitFor();
  await click('내용 수정');
  const editor = page.getByRole('textbox', {
    name: '일기 본문 수정',
    exact: true,
  });
  await editor.fill('');
  assert(
    await page
      .getByRole('button', { name: '변경사항 저장', exact: true })
      .isDisabled(),
  );
  await editor.fill('저장 실패에도 유지할 수정본');
  await page.evaluate(() => {
    window.failWrite = true;
  });
  await click('변경사항 저장');
  await page
    .getByRole('alert')
    .filter({ hasText: '저장하지 못했어요' })
    .waitFor();
  assert.equal(await editor.inputValue(), '저장 실패에도 유지할 수정본');
  await page.evaluate(() => {
    window.failWrite = false;
  });
  await click('변경사항 저장');
  await page.waitForURL('**/calendar**');
  const stored = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem('@growtogether/diary/preview/v2/2026-10-31'),
    ),
  );
  assert.equal(stored.content, '저장 실패에도 유지할 수정본');
  assert.deepEqual(stored.photoUris, original.photoUris);
  assert.deepEqual(stored.sourceRecords, original.sourceRecords);
  await click('선택한 날짜의 일기 보기');
  await click('일기 삭제');
  await click('취소');
  assert(
    await page.evaluate(
      () => !!localStorage.getItem('@growtogether/diary/preview/v2/2026-10-31'),
    ),
  );
  await click('일기 삭제');
  await page.evaluate(() => {
    window.failDelete = true;
  });
  await click('삭제');
  await page
    .getByRole('alert')
    .filter({ hasText: '삭제하지 못했어요' })
    .last()
    .waitFor();
  await page.evaluate(() => {
    window.failDelete = false;
  });
  await click('삭제');
  await page.waitForURL('**/calendar**');
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem('@growtogether/diary/preview/v2/2026-10-31'),
    ),
    null,
  );
  assert(
    await page.evaluate(
      () => !!localStorage.getItem('@growtogether/diary/v1/2026-10-30'),
    ),
  );
  console.log(
    'PASS preview edit validation, failed writes/retry, metadata/photos, delete cancel/failure/retry and legacy preservation',
  );
} catch (error) {
  console.error((await page.locator('body').innerText()).slice(0, 1600));
  throw error;
} finally {
  await browser.close();
}
