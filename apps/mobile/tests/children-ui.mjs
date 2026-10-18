import { authenticatedSessionFixture } from './auth-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright-core';

// Run against a served Expo web export. BROWSER=webkit also checks WebKit.
const url = process.env.CHILDREN_URL ?? 'http://localhost:8096';
const artifacts = process.env.ARTIFACT_DIR ?? '/tmp/growtogether-children-46';
await mkdir(artifacts, { recursive: true });
const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
});

try {
  for (const timezoneId of ['Asia/Seoul', 'America/Los_Angeles']) {
    const context = await browser.newContext({
      viewport: { width: 320, height: 568 },
      timezoneId,
    });
    const page = await context.newPage();
    await page.addInitScript(authenticatedSessionFixture);
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const name = page.getByRole('textbox', { name: '아이 이름', exact: true });
    const birthday = page.getByRole('textbox', {
      name: '생년월일',
      exact: true,
    });
    const confirm = page.getByRole('button', {
      name: '입력 내용 확인',
      exact: true,
    });
    const edit = page.getByRole('button', { name: '다시 수정', exact: true });
    const back = page.getByRole('button', { name: '마이페이지로 돌아가기' });
    const ready = () =>
      page.waitForFunction(() =>
        [...document.querySelectorAll('[role="button"]')].some((node) =>
          Object.keys(node).some((key) => key.startsWith('__reactProps')),
        ),
      );
    const expectValue = async (field, value) => {
      await page.waitForFunction(
        ({ label, value }) =>
          document.querySelector(`[aria-label="${label}"]`)?.value === value,
        { label: await field.getAttribute('aria-label'), value },
      );
    };
    const expectError = async (text) => {
      await page.getByRole('alert').filter({ hasText: text }).waitFor();
      assert.ok(await confirm.isVisible());
    };
    const review = async (value) => {
      await birthday.fill(value);
      await confirm.click();
      await edit.waitFor();
      assert.equal(await page.getByText(value, { exact: true }).count(), 1);
      await edit.click();
      await expectValue(birthday, value);
    };

    await page.goto(`${url}/children`);
    await ready();
    await name.waitFor();
    assert.ok(await page.getByText(/입력한 정보는 저장되지/).isVisible());
    await confirm.click();
    await expectError('아이 이름을 입력해주세요.');
    await expectError('생년월일을 올바른');
    assert.equal(await name.getAttribute('aria-invalid'), 'true');
    assert.equal(await birthday.getAttribute('aria-invalid'), 'true');
    await name.fill('   ');
    await confirm.click();
    await expectError('아이 이름을 입력해주세요.');
    await name.fill('  하늘  ');
    for (const invalid of [
      ' ',
      '2024/03/15',
      '2024-3-15',
      '2024-00-01',
      '2024-13-01',
      '2024-01-00',
      '2024-04-31',
      '2023-02-29',
      '1900-02-29',
      '0000-01-01',
    ]) {
      await birthday.fill(invalid);
      await confirm.click();
      await expectError('생년월일을 올바른');
    }
    const dates = await page.evaluate(() => {
      const date = new Date();
      const key = (value) =>
        `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
      const today = key(date);
      date.setDate(date.getDate() + 1);
      return { today, tomorrow: key(date) };
    });
    await birthday.fill(dates.tomorrow);
    await confirm.click();
    await expectError('생년월일은 오늘 또는 이전');
    await birthday.fill(' 2024-02-29 ');
    await birthday.press('Enter');
    await edit.waitFor();
    assert.ok(await page.getByText('하늘', { exact: true }).isVisible());
    assert.ok(await page.getByText('2024-02-29', { exact: true }).isVisible());
    await edit.click();
    await expectValue(name, '하늘');
    await expectValue(birthday, '2024-02-29');
    await name.fill('바다');
    await review(dates.today);
    await review('2000-02-29');
    await review('0001-01-01');
    await review('0099-12-31');
    await review('0100-01-01');
    await confirm.click();
    await edit.waitFor();
    assert.ok(await page.getByText('바다', { exact: true }).isVisible());
    await page.reload();
    await ready();
    await expectValue(name, '');
    await expectValue(birthday, '');

    // Leave the screen through navigation, then return to its retained history entry.
    await name.fill('임시 입력');
    await birthday.fill('2024-03-15');
    await page.goto(`${url}/mypage`);
    await ready();
    await page.goBack();
    await ready();
    await expectValue(name, '');
    await expectValue(birthday, '');
    // Direct entry has a working destination without requiring an in-app back stack.
    await back.click();
    await page.waitForURL(`${url}/mypage`);
    await page.getByRole('heading', { name: '마이페이지' }).waitFor();
    await page.getByRole('button', { name: /가족 정보/ }).click();
    await page
      .getByRole('alert')
      .filter({ hasText: '가족 정보 화면은 준비 중입니다.' })
      .waitFor();
    assert.equal(await page.getByRole('tablist').getByRole('tab').count(), 5);
    await page.getByRole('button', { name: /아이 프로필/ }).click();
    await page.waitForURL(`${url}/children`);
    await expectValue(name, '');
    await name.fill('남아 있으면 안 되는 이름');
    await page.goBack();
    await page.waitForURL(`${url}/mypage`);
    await page.goForward();
    await page.waitForURL(`${url}/children`);
    await expectValue(name, '');

    for (const width of [320, 390, 1024]) {
      await page.setViewportSize({ width, height: 568 });
      await name.fill('하늘');
      await birthday.fill('2024-03-15');
      await name.focus();
      await page.keyboard.press('Enter');
      assert.ok(
        await birthday.evaluate((node) => node === document.activeElement),
      );
      await page.keyboard.press('Tab');
      assert.ok(
        await confirm.evaluate((node) => node === document.activeElement),
      );
      await page.keyboard.press('Enter');
      await edit.waitFor();
      await edit.click();
      await confirm.scrollIntoViewIfNeeded();
      const box = await confirm.boundingBox();
      assert.ok(box.height >= 48 && box.y >= 0 && box.y + box.height <= 568);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.ok(await name.isVisible());
      await page.screenshot({
        path: `${artifacts}/${engine.name()}-${timezoneId.replace('/', '-')}-${width}.png`,
      });
    }
    assert.deepEqual(pageErrors, []);
    console.log(
      `PASS ${engine.name()} ${timezoneId}: date validation, review/edit, reset, navigation, keyboard and responsive layout`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
