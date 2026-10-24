import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';

const siteUrl = process.argv[2] ?? 'http://localhost:8095';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
await page.addInitScript(authenticatedSessionFixture);
const click = (name) => page.getByRole('button', { name, exact: true }).click();
const edit = () => page.getByRole('textbox', { name: '일기 본문 수정' });
const regen = () => page.getByRole('button', { name: /^다시 생성하기,/ });
const key = '@growtogether/diary/v1/2026-10-12';
try {
  await page.goto(`${siteUrl}/diary?date=2026-10-12&mode=create`);
  await click('다음으로');
  await click('일기 생성하기');
  await page
    .getByRole('alert')
    .filter({ hasText: '활동을 선택하거나 오늘의 관찰을 적어주세요.' })
    .waitFor();
  await page
    .getByRole('textbox', { name: '오늘의 성장 한 줄 기록' })
    .fill('숟가락을 직접 잡으려 했어요.');
  await click('일기 생성하기');
  await click('수정');
  const original = await edit().inputValue();
  await edit().fill('긴 기록도 편안하게 읽고 수정해요.\n'.repeat(40));
  await page.waitForFunction(() => {
    const input = document.querySelector(
      'textarea[aria-label="일기 본문 수정"]',
    );
    return input && input.scrollHeight <= input.clientHeight + 1;
  });

  await edit().fill('취소할 수정');
  await click('취소');
  await click('수정');
  assert.equal(await edit().inputValue(), original);
  await edit().fill('   ');
  assert(
    await page
      .getByRole('button', { name: '수정 완료', exact: true })
      .isDisabled(),
  );
  assert.equal(
    await page
      .getByRole('button', { name: '이 일기 저장하기', exact: true })
      .count(),
    0,
  );
  await edit().fill('직접 다듬은 오늘의 일기.');
  await click('수정 완료');
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), key),
    null,
  );
  await regen().click();
  await page.getByRole('dialog').waitFor();
  await click('취소');
  await page.getByText('직접 다듬은 오늘의 일기.', { exact: true }).waitFor();
  assert((await regen().getAttribute('aria-label')).includes('3회'));
  await regen().click();
  await click('다시 생성');
  await regen().waitFor();
  assert((await regen().getAttribute('aria-label')).includes('2회'));
  await click('뒤로가기');
  await click('작성 중인 일기로 돌아가기');
  assert((await regen().getAttribute('aria-label')).includes('2회'));
  await regen().click();
  await page
    .getByRole('button', { name: '다시 생성하기, 남은 횟수 1회', exact: true })
    .waitFor();
  await regen().click();
  await page
    .getByRole('button', { name: '다시 생성하기, 남은 횟수 0회', exact: true })
    .waitFor();
  assert(await regen().isDisabled());
  await click('뒤로가기');
  assert(
    await page
      .getByRole('button', { name: '일기 생성하기', exact: true })
      .isDisabled(),
  );
  await click('작성 중인 일기로 돌아가기');
  assert(await regen().isDisabled());
  await click('수정');
  await edit().fill('직접 다듬은 오늘의 일기.');
  await click('수정 완료');
  await click('이 일기에 사용된 기록 확인');
  await page
    .getByText('숟가락을 직접 잡으려 했어요.', { exact: true })
    .waitFor();
  for (const heading of [
    '기록 속 감정',
    '오늘 발견한 성장 순간',
    '내일의 작은 제안',
  ])
    assert.equal(
      await page.getByRole('heading', { name: heading, exact: true }).count(),
      0,
    );
  assert.equal(await page.getByLabel('일기 사진 목록').count(), 0);
  await page.screenshot({
    path: '/tmp/growtogether-diary-preview-320.png',
    fullPage: true,
  });
  // Failed saves retain the edited preview and support retry.
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    window.diaryWrites = 0;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('@growtogether/diary/v1/')) {
        window.diaryWrites++;
        if (window.failSave) throw new Error('Quota exceeded');
      }
      return setItem.call(this, key, value);
    };
    window.failSave = true;
  });
  await click('이 일기 저장하기');
  await page
    .getByRole('alert')
    .filter({ hasText: '일기를 저장하지 못했어요.' })
    .waitFor();
  await page.getByText('직접 다듬은 오늘의 일기.', { exact: true }).waitFor();
  await page.evaluate(() => {
    window.failSave = false;
  });
  // Delay storage validation to assert that a second tap cannot submit again.
  await page.evaluate((key) => {
    const getItem = Storage.prototype.getItem;
    window.diaryReads = 0;
    Storage.prototype.getItem = function (currentKey) {
      if (key === currentKey) {
        window.diaryReads++;
        return new Promise((resolve) => {
          window.finishSave = () => {
            Storage.prototype.getItem = getItem;
            resolve(getItem.call(this, key));
          };
        });
      }
      return getItem.call(this, currentKey);
    };
  }, key);
  await click('이 일기 저장하기');
  const pending = page.getByRole('button', { name: '저장 중...', exact: true });
  await pending.waitFor();
  await pending.dispatchEvent('click');
  assert.equal(await page.evaluate(() => window.diaryReads), 1);
  assert(await regen().isDisabled());
  await page.evaluate(() => window.finishSave());
  await page.waitForURL('**/calendar*');
  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    key,
  );
  assert.equal(stored.content, '직접 다듬은 오늘의 일기.');
  assert.equal(stored.sourceRecords.note, '숟가락을 직접 잡으려 했어요.');
  assert.deepEqual(stored.emotions, []);
  assert.deepEqual(stored.growthPoints, []);
  await page.goto(`${siteUrl}/diary?date=2026-10-12&mode=view`);
  await page.getByText(stored.content, { exact: true }).waitFor();
  assert.equal(
    await page.getByRole('button', { name: '수정', exact: true }).count(),
    0,
  );
  assert.equal(await regen().count(), 0);
  await page.screenshot({
    path: '/tmp/growtogether-diary-saved-320.png',
    fullPage: true,
  });
  // Legacy stored diaries have no optional source/tip and still render insights.
  await page.evaluate(() =>
    localStorage.setItem(
      '@growtogether/diary/v1/2026-10-13',
      JSON.stringify({
        date: '2026-10-13',
        content: '예전에 저장한 일기',
        emotions: ['기쁨'],
        growthPoints: ['숟가락을 잡았어요.'],
        photoUris: [],
        tomorrowTip: '함께 책을 읽어보세요.',
      }),
    ),
  );
  await page.goto(`${siteUrl}/diary?date=2026-10-13&mode=view`);
  await page.getByText('예전에 저장한 일기', { exact: true }).waitFor();
  await page.getByRole('heading', { name: '기록 속 감정' }).waitFor();
  await page.getByRole('heading', { name: '오늘 발견한 성장 순간' }).waitFor();
  await page.getByRole('heading', { name: '내일의 작은 제안' }).waitFor();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 820 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    const saveBounds = await page
      .getByRole('button', { name: '캘린더로 돌아가기', exact: true })
      .boundingBox();
    assert(saveBounds.width <= 600 && saveBounds.height >= 44);
    await page.screenshot({
      path: `/tmp/growtogether-diary-${width}.png`,
      fullPage: true,
    });
  }
  // In-app exit asks before discarding a draft; cancellation preserves the note.
  await page.goto(`${siteUrl}/diary?date=2026-10-14&mode=create`);
  await click('다음으로');
  await page
    .getByRole('textbox', { name: '오늘의 성장 한 줄 기록' })
    .fill('남겨둘 메모');
  await click('뒤로가기');
  await click('뒤로가기');
  await page.getByRole('dialog').waitFor();
  await click('취소');
  await click('다음으로');
  assert.equal(
    await page
      .getByRole('textbox', { name: '오늘의 성장 한 줄 기록' })
      .inputValue(),
    '남겨둘 메모',
  );
  await click('뒤로가기');
  await click('뒤로가기');
  await click('나가기');
  await page.waitForURL('**/calendar*');
  console.log(
    'PASS diary edit/cancel/empty validation, regeneration confirmation/count, missing insights/photos, source records, failed save/retry, duplicate save, edited persistence, saved/legacy rendering, responsive layout and draft exit confirmation',
  );
} catch (error) {
  console.error(await page.locator('body').innerText());
  throw error;
} finally {
  await browser.close();
}
