import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 375, height: 740 } });
page.setDefaultTimeout(15000);
await page.addInitScript(authenticatedSessionFixture);
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ status: 404, json: {} }),
);
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
await page.route('**/api/v1/auth/logout', (r) => r.fulfill({ status: 204 }));
const second = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ iss: 'growtogether-api', sub: '2' })).toString('base64url')}.ui-test`;
await page.route('**/api/v1/auth/login', (r) =>
  r.fulfill({
    json: {
      accessToken: second,
      refreshToken: 'second-refresh',
      tokenType: 'Bearer',
      expiresIn: 900,
    },
  }),
);
try {
  await page.goto(
    (process.env.MOBILE_URL ?? 'http://localhost:8156') +
      '/diary?date=2026-10-31',
    { timeout: 120000, waitUntil: 'commit' },
  );
  await page
    .getByRole('textbox', { name: '추가 관찰 메모', exact: true })
    .fill('첫 계정의 비공개 관찰');
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  await page
    .getByRole('textbox', { name: '상담 질문 입력', exact: true })
    .fill('첫 계정의 비공개 질문');
  await page.getByRole('button', { name: '앱 설정', exact: true }).click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page
    .getByRole('textbox', { name: '이메일', exact: true })
    .fill('second@example.com');
  await page
    .getByRole('textbox', { name: '비밀번호', exact: true })
    .fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  assert.equal(
    await page
      .getByRole('textbox', { name: '상담 질문 입력', exact: true })
      .inputValue(),
    '',
  );
  await page.getByRole('tab', { name: '기록', exact: true }).click();
  assert.equal(
    await page
      .getByRole('button', { name: '작성하던 일기 이어 쓰기', exact: true })
      .count(),
    0,
  );
  await page.getByRole('button', { name: '앱 설정', exact: true }).click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page
    .getByRole('button', { name: '인증 없이 미리보기 진입', exact: true })
    .click();
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  assert.equal(
    await page
      .getByRole('textbox', { name: '상담 질문 입력', exact: true })
      .inputValue(),
    '',
  );
  await page.getByRole('tab', { name: '기록', exact: true }).click();
  assert.equal(
    await page
      .getByRole('button', { name: '작성하던 일기 이어 쓰기', exact: true })
      .count(),
    0,
  );
  console.log('PASS account switch and preview clear diary/question drafts');
} finally {
  await browser.close();
}
