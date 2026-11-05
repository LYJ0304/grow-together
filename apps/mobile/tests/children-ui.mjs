import { authenticatedSessionFixture } from './auth-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const url = process.env.CHILDREN_URL ?? 'http://localhost:8130';
const artifacts = process.env.ARTIFACT_DIR ?? '/tmp/grow-children-130';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/opt/google/chrome/chrome',
  args: ['--no-sandbox'],
});
try {
  for (const timezoneId of ['Asia/Seoul', 'America/Los_Angeles']) {
    const context = await browser.newContext({
      viewport: { width: 320, height: 720 },
      timezoneId,
    });
    await context.addInitScript(authenticatedSessionFixture);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const screen = () =>
      page
        .getByRole('heading', {
          name: /^(아이 프로필|아이 추가|아이 정보 수정)$/,
        })
        .locator('..');
    const click = (name) =>
      page.getByRole('button', { name, exact: true }).click();
    const name = page.getByRole('textbox', { name: '아이 이름', exact: true });
    const birthday = page.getByRole('textbox', {
      name: '생년월일',
      exact: true,
    });
    const alert = (text) =>
      page.getByRole('alert').filter({ hasText: text }).waitFor();
    await page.goto(`${url}/children`);
    await page.getByText('등록된 아이가 없어요.').waitFor();
    await click('아이 추가');
    await click('저장');
    await alert('아이 이름을 입력');
    await name.fill('  하늘  ');
    for (const invalid of [
      '2023-02-29',
      '2024-04-31',
      '0000-01-01',
      '2024/03/15',
      '9999-01-01',
    ]) {
      await birthday.fill(invalid);
      await click('저장');
      await alert(/생년월일/);
    }
    await birthday.fill('2024-02-29');
    await click('저장');
    await screen().getByText('하늘', { exact: true }).waitFor();
    await click('마이페이지로 돌아가기');
    await page.getByRole('heading', { name: '마이페이지' }).waitFor();
    await page.getByText('하늘 · 2024-02-29', { exact: true }).waitFor();
    await page.getByRole('button', { name: /아이 프로필/ }).click();
    await click('수정');
    assert.equal(await name.inputValue(), '하늘');
    await name.fill('취소할 이름');
    await click('취소');
    await screen().getByText('하늘', { exact: true }).waitFor();
    await click('수정');
    await name.fill('바다');
    await click('마이페이지로 돌아가기');
    await page.getByText('저장하지 않은 변경사항이 있어요.').waitFor();
    await click('계속 작성');
    assert.equal(await name.inputValue(), '바다');
    // Storage errors preserve the old profile and edited input.
    await page.evaluate(() => {
      window.originalProfileSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('@growtogether/child/')) throw new Error('quota');
        return window.originalProfileSet.call(this, key, value);
      };
    });
    await click('저장');
    await alert('저장하지 못했어요');
    assert.equal(await name.inputValue(), '바다');
    await page.evaluate(() => {
      Storage.prototype.setItem = window.originalProfileSet;
    });
    await click('저장');
    await screen().getByText('바다', { exact: true }).waitFor();
    await page.reload();
    await screen().getByText('바다', { exact: true }).waitFor();
    await click('수정');
    await name.fill('버릴 이름');
    await click('마이페이지로 돌아가기');
    await click('변경사항 버리고 나가기');
    await page.waitForURL('**/mypage');
    await page.getByRole('button', { name: /아이 프로필/ }).click();
    await screen().getByText('바다', { exact: true }).waitFor();
    // A different account using the same device storage sees an empty profile.
    const other = await browser.newContext({
      storageState: await context.storageState(),
    });
    await other.addInitScript(authenticatedSessionFixture, '2');
    const second = await other.newPage();
    await second.goto(`${url}/children`);
    await second.getByText('등록된 아이가 없어요.').waitFor();
    await other.close();
    for (const width of [320, 390, 1024]) {
      await page.setViewportSize({ width, height: 720 });
      await click('수정');
      await page
        .getByRole('button', { name: '저장', exact: true })
        .scrollIntoViewIfNeeded();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      const box = await page
        .getByRole('button', { name: '저장', exact: true })
        .boundingBox();
      assert.ok(box.height >= 44);
      await page.screenshot({
        path: `${artifacts}/${timezoneId.replace('/', '-')}-${width}.png`,
      });
      await click('취소');
    }
    // Failed reads are not treated as an empty registration form.
    await page.addInitScript(() => {
      const get = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (key.startsWith('@growtogether/child/'))
          throw new Error('read failed');
        return get.call(this, key);
      };
    });
    await page.reload();
    await alert('불러오지 못했어요');
    assert.equal(
      await page
        .getByRole('button', { name: '아이 추가', exact: true })
        .count(),
      0,
    );
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `PASS ${timezoneId}: profile create/edit/restore, cancel, errors, account isolation and responsive layout`,
    );
  }
} finally {
  await browser.close();
}
