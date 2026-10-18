import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Set AUTH_TEST_PREVIEW=true to test the default QA build; otherwise disable preview in Expo.
// Point EXPO_PUBLIC_API_URL at the test API.
// AUTH_TEST_LIVE=true uses the actual API; otherwise responses are intercepted.
const siteUrl = process.argv[2] ?? 'http://localhost:8096';
const live = process.env.AUTH_TEST_LIVE === 'true';
const previewEnabled = process.env.AUTH_TEST_PREVIEW === 'true';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const email = `auth-${Date.now()}@example.com`;
const password = 'auth-test-password';
const sessionKey = 'growtogether.auth.v1';
try {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(120000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (!live) {
    let registered = false;
    let rotations = 0;
    await page.route('**/api/v1/auth/*', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const body = route.request().postDataJSON();
      let status = 200;
      let result;
      if (path.endsWith('/signup')) {
        if (registered) {
          status = 409;
          result = { code: 'EMAIL_ALREADY_EXISTS' };
        } else {
          registered = true;
          status = 201;
          result = { message: 'Signup Successful' };
        }
      } else if (path.endsWith('/login') && body.password !== password) {
        status = 401;
        result = { code: 'INVALID_CREDENTIALS' };
      } else if (path.endsWith('/logout')) {
        status = 204;
      } else {
        result = {
          accessToken: `test-access-${++rotations}`,
          refreshToken: `test-refresh-${rotations}`,
          tokenType: 'Bearer',
          expiresIn: 900,
        };
      }
      await route.fulfill({
        status,
        contentType: 'application/json',
        ...(result ? { body: JSON.stringify(result) } : {}),
      });
    });
  }
  const heading = (name) => page.getByRole('heading', { name, exact: true });
  const fillLogin = async (value = password) => {
    await page
      .getByRole('textbox', { name: '이메일', exact: true })
      .fill(email);
    await page.getByLabel('비밀번호', { exact: true }).fill(value);
    await page.getByRole('button', { name: '로그인', exact: true }).click();
  };

  // Direct links must redirect before protected content is shown.
  await page.goto(`${siteUrl}/mypage`);
  await heading('다시 만났네요!').waitFor();
  assert.equal(
    await page.getByRole('button', { name: '인증 없이 미리보기 진입' }).count(),
    previewEnabled ? 1 : 0,
  );
  assert.equal(await heading('마이페이지').count(), 0);

  if (previewEnabled) {
    await page.getByRole('button', { name: '인증 없이 미리보기 진입' }).click();
    await page.waitForURL('**/main');
    await page.getByText('미리보기 · 서버 API를 이용할 수 없어요.').waitFor();
    assert.equal(
      await page.evaluate((key) => sessionStorage.getItem(key), sessionKey),
      null,
    );
    await page
      .getByRole('button', { name: '미리보기 종료', exact: true })
      .click();
    await heading('다시 만났네요!').waitFor();
  }

  await page.getByRole('link', { name: '회원가입', exact: true }).click();
  await heading('함께 키워가요').waitFor();
  const signup = async () => {
    await page
      .getByRole('textbox', { name: '이름', exact: true })
      .fill('인증 테스트');
    await page
      .getByRole('textbox', { name: '이메일', exact: true })
      .fill(email);
    await page.getByLabel('비밀번호', { exact: true }).fill(password);
    await page.getByLabel('비밀번호 확인', { exact: true }).fill(password);
    await page.getByRole('button', { name: '가입하기', exact: true }).click();
  };
  await signup();
  await heading('다시 만났네요!').waitFor();
  await page
    .getByText('가입이 완료되었어요. 로그인해 주세요.', { exact: true })
    .waitFor();
  await page.getByRole('link', { name: '회원가입', exact: true }).click();
  await signup();
  await page.getByText('이미 가입된 이메일이에요.', { exact: true }).waitFor();
  await page.getByRole('link', { name: '로그인', exact: true }).click();
  await fillLogin('wrong-password');
  await page
    .getByText('이메일 또는 비밀번호를 확인해 주세요.', { exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole('textbox', { name: '이메일', exact: true })
      .inputValue(),
    email,
  );
  await fillLogin();
  await page.waitForURL('**/main');
  const before = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    sessionKey,
  );
  assert(before);
  await page.reload();
  await page.waitForURL('**/main');
  await page.waitForFunction(
    (key) => Boolean(sessionStorage.getItem(key)),
    sessionKey,
  );
  // Wait until restoration rotated and committed, not just until the URL matched.
  await page.waitForFunction(
    ({ key, value }) => sessionStorage.getItem(key) !== value,
    { key: sessionKey, value: before },
  );

  await page.goto(`${siteUrl}/mypage`);
  await heading('마이페이지').waitFor();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await heading('다시 만났네요!').waitFor();
  assert.equal(
    await page.evaluate((key) => sessionStorage.getItem(key), sessionKey),
    null,
  );
  await page.goBack();
  await heading('다시 만났네요!').waitFor();
  assert.equal(await heading('마이페이지').count(), 0);

  // Startup network failure must preserve credentials and offer retry/logout.
  await fillLogin();
  await page.waitForURL('**/main');
  const offline = async (route) => route.abort('connectionfailed');
  await page.route('**/api/v1/auth/refresh', offline);
  await page.reload();
  await page.getByRole('button', { name: '다시 시도', exact: true }).waitFor();
  assert(await page.evaluate((key) => sessionStorage.getItem(key), sessionKey));
  await page.unroute('**/api/v1/auth/refresh', offline);
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await page
    .getByRole('button', { name: '다시 시도', exact: true })
    .waitFor({ state: 'hidden' });
  await page.goto(`${siteUrl}/mypage`);
  await heading('마이페이지').waitFor();
  await page.route('**/api/v1/auth/logout', offline);
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await heading('다시 만났네요!').waitFor();
  await page.getByText(/기기에서 로그아웃했어요/).waitFor();
  assert.equal(
    await page.evaluate((key) => sessionStorage.getItem(key), sessionKey),
    null,
  );
  assert.deepEqual(errors, []);
  await context.close();
  console.log(`Auth UI checks passed (${live ? 'live API' : 'mock API'})`);
} finally {
  await browser.close();
}
