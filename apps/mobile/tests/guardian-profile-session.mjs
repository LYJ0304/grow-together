import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
page.setDefaultTimeout(8000);
await page.addInitScript(authenticatedSessionFixture);
let release;
const secondPending = new Promise((resolve) => {
  release = resolve;
});
const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ iss: 'growtogether-api', sub: '2' })).toString('base64url')}.ui-test`;
await page.route('**/api/v1/auth/logout', (r) => r.fulfill({ status: 204 }));
await page.route('**/api/v1/auth/login', (r) =>
  r.fulfill({
    json: {
      accessToken: token,
      refreshToken: 'second-refresh',
      tokenType: 'Bearer',
      expiresIn: 900,
    },
  }),
);
await page.route('**/api/v1/users/me', async (r) => {
  const raw = r.request().headers().authorization.split(' ')[1];
  const id = JSON.parse(Buffer.from(raw.split('.')[1], 'base64url')).sub;
  if (id === '2') await secondPending;
  return r.fulfill({
    json: {
      id: Number(id),
      name: id === '1' ? '첫 보호자' : '둘째 보호자',
      email: id === '1' ? 'one@example.com' : 'two@example.com',
    },
  });
});
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2024-01-01' } }),
);
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
await page.route('**/api/v1/diary**', (r) =>
  r.fulfill(
    new URL(r.request().url()).searchParams.has('month')
      ? { json: [] }
      : { status: 404, json: {} },
  ),
);
const click = (name) => page.getByRole('button', { name, exact: true }).click();
try {
  await page.goto(
    `${process.env.MOBILE_URL ?? 'http://localhost:8272'}/mypage`,
  );
  await page.getByText('첫 보호자', { exact: true }).waitFor();
  await click('로그아웃');
  await page
    .getByRole('textbox', { name: '이메일', exact: true })
    .fill('two@example.com');
  await page
    .getByRole('textbox', { name: '비밀번호', exact: true })
    .fill('password123');
  await click('로그인');
  await click('내 프로필 열기');
  await page.getByText('내 정보 확인 중', { exact: true }).waitFor();
  assert.equal(await page.getByText('첫 보호자', { exact: true }).count(), 0);
  release();
  await page.getByText('둘째 보호자', { exact: true }).waitFor();
  await page.getByText('two@example.com', { exact: true }).waitFor();
  assert.equal(
    await page.getByText('one@example.com', { exact: true }).count(),
    0,
  );
  console.log(
    'PASS account switch clears profile cache before next owner response and uses new JWT identity',
  );
} finally {
  await browser.close();
}
