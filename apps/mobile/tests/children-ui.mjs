import { Buffer } from 'node:buffer';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const url = process.env.CHILDREN_URL ?? 'http://localhost:8130';
const artifacts = process.env.ARTIFACT_DIR ?? '/tmp/grow-children-141';
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
    const profiles = new Map();
    const writes = [];
    let readFailure = false;
    let writeFailure = false;
    let holdWrite;
    let releaseWrite;
    const handleProfile = async (route) => {
      const request = route.request();
      const token = request.headers().authorization;
      assert.ok(token?.startsWith('Bearer '));
      const subject = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url'),
      ).sub;
      const method = request.method();
      if (method === 'GET') {
        return route.fulfill({
          status: readFailure ? 500 : profiles.has(subject) ? 200 : 404,
          json: readFailure
            ? { code: 'HTTP_ERROR' }
            : (profiles.get(subject) ?? { code: 'NOT_FOUND' }),
        });
      }
      writes.push(method);
      if (holdWrite) {
        holdWrite();
        await new Promise((resolve) => {
          releaseWrite = resolve;
        });
      }
      if (writeFailure)
        return route.fulfill({ status: 500, json: { code: 'HTTP_ERROR' } });
      if (method === 'POST' && profiles.has(subject))
        return route.fulfill({ status: 409, json: { code: 'CONFLICT' } });
      const value = request.postDataJSON();
      profiles.set(subject, value);
      return route.fulfill({
        status: method === 'POST' ? 201 : 200,
        json: value,
      });
    };
    await context.route('**/api/v1/children/me', handleProfile);
    await context.addInitScript(() => {
      // Old authenticated local data must neither replace server data nor be uploaded.
      localStorage.setItem(
        '@growtogether/child/v1/growtogether-api%3A1',
        JSON.stringify({ name: '기존 로컬', birthday: '2020-01-01' }),
      );
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
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
    assert.deepEqual(writes, []);
    await page.getByText('로그인한 계정에 저장되는 아이 정보예요.').waitFor();
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
    const started = new Promise((resolve) => {
      holdWrite = resolve;
    });
    await click('저장');
    await started;
    await page
      .getByRole('button', { name: '저장 중...', exact: true })
      .waitFor();
    await page
      .getByRole('button', { name: '저장 중...', exact: true })
      .evaluate((button) => button.click());
    assert.equal(writes.length, 1);
    releaseWrite();
    holdWrite = null;
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
    // Server failures preserve the previous profile and edited input.
    writeFailure = true;
    await click('저장');
    await alert('요청을 처리하지 못했어요');
    assert.equal(await name.inputValue(), '바다');
    assert.equal(profiles.get('1').name, '하늘');
    writeFailure = false;
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
    await other.route('**/api/v1/children/me', handleProfile);
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
    // Failed reads must not become an empty registration form.
    readFailure = true;
    await page.reload();
    await alert('요청을 처리하지 못했어요');
    assert.equal(
      await page
        .getByRole('button', { name: '아이 추가', exact: true })
        .count(),
      0,
    );
    readFailure = false;
    await click('다시 시도');
    await screen().getByText('바다', { exact: true }).waitFor();
    // Another client registered between GET and POST: do not overwrite it.
    profiles.delete('1');
    await page.reload();
    await click('아이 추가');
    await name.fill('내 입력');
    await birthday.fill('2024-02-29');
    profiles.set('1', { name: '다른 기기', birthday: '2024-01-01' });
    const before = writes.length;
    await click('저장');
    await alert('이미 등록된 아이 정보가 있어요');
    assert.equal(await name.inputValue(), '내 입력');
    assert.deepEqual(writes.slice(before), ['POST']);
    await click('등록 정보 다시 확인');
    assert.equal(await name.inputValue(), '내 입력');
    await click('저장');
    await screen().getByText('내 입력', { exact: true }).waitFor();
    assert.equal(writes.at(-1), 'PUT');
    assert.equal(profiles.get('1').name, '내 입력');
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem('@growtogether/child/v1/growtogether-api%3A1'),
          ).name,
      ),
      '기존 로컬',
    );
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `PASS ${timezoneId}: profile create/edit/restore, cancel, errors, account isolation and responsive layout`,
    );
  }
  const preview = await browser.newContext();
  const previewRequests = [];
  await preview.route('**/api/**', async (route) => {
    previewRequests.push(route.request().url());
    await route.abort();
  });
  const page = await preview.newPage();
  await page.goto(`${url}/login`);
  await page.getByRole('button', { name: '인증 없이 미리보기 진입' }).click();
  await page.waitForURL('**/main');
  await page
    .getByRole('button', { name: '프로필과 설정', exact: true })
    .click();
  await page.getByRole('button', { name: /아이 프로필/ }).click();
  await page
    .getByText('이 기기에 저장되는 미리보기용 아이 정보예요.')
    .waitFor();
  await page.getByRole('button', { name: '아이 추가', exact: true }).click();
  await page
    .getByRole('textbox', { name: '아이 이름', exact: true })
    .fill('미리보기 아이');
  await page
    .getByRole('textbox', { name: '생년월일', exact: true })
    .fill('2024-02-29');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page
    .getByRole('heading', { name: '아이 프로필', exact: true })
    .locator('..')
    .getByText('미리보기 아이', { exact: true })
    .waitFor();
  await page.getByRole('button', { name: '마이페이지로 돌아가기' }).click();
  await page.getByText('미리보기 아이 · 2024-02-29', { exact: true }).waitFor();
  await page.getByRole('button', { name: /아이 프로필/ }).click();
  await page
    .getByRole('heading', { name: '아이 프로필', exact: true })
    .locator('..')
    .getByText('미리보기 아이', { exact: true })
    .waitFor();
  assert.deepEqual(previewRequests, []);
  await preview.close();
  console.log('PASS preview: local profile save/restore without API requests');
} finally {
  await browser.close();
}
