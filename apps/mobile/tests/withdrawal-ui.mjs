import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const base = process.env.MOBILE_URL ?? 'http://localhost:8252';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 320, height: 740 },
  reducedMotion: 'reduce',
});
page.setDefaultTimeout(30000);
page.setDefaultNavigationTimeout(120000);
await page.addInitScript(authenticatedSessionFixture);
let writes = 0,
  mode = 'wrong',
  release;
let held = new Promise((resolve) => {
  release = resolve;
});
await page.route('**/api/**', async (r) => {
  const path = new URL(r.request().url()).pathname;
  if (path.endsWith('/users/me/withdrawal')) {
    writes++;
    assert.equal(r.request().postDataJSON().password, 'password123');
    if (mode === 'wrong')
      return r.fulfill({ status: 400, json: { code: 'INVALID_PASSWORD' } });
    if (mode === 'uncertain')
      return r.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR' } });
    await held;
    return r.fulfill({ status: 204 });
  }
  if (path.endsWith('/users/me'))
    return r.fulfill({
      json: { id: 1, name: '보호자', email: 'test@example.test' },
    });
  if (path.endsWith('/children/me'))
    return r.fulfill({ json: { name: '아이', birthday: '2024-01-01' } });
  return r.fulfill({ json: [] });
});
const button = (name) => page.getByRole('button', { name, exact: true });
const input = page.getByLabel('현재 비밀번호', { exact: true });
const consent = page.getByRole('checkbox', {
  name: '삭제 및 복구 불가 안내 확인',
  exact: true,
});
try {
  await page.goto(base + '/mypage');
  await button('회원 탈퇴').click();
  await page.waitForURL('**/withdrawal');
  await input.waitFor();
  assert(await button('회원 탈퇴').isDisabled());
  await input.fill('password123');
  await consent.click();
  await button('회원 탈퇴').click();
  await button('계속 이용하기').click();
  assert.equal(writes, 0);
  assert.equal(await input.inputValue(), 'password123');
  await button('회원 탈퇴').click();
  await button('탈퇴 확정').click();
  await page
    .getByText('현재 비밀번호를 확인해주세요.', { exact: true })
    .waitFor();
  assert.equal(writes, 1);
  assert.equal(await input.inputValue(), '');
  assert(page.url().endsWith('/withdrawal'));
  assert.equal(
    await page.evaluate(() =>
      Object.values(sessionStorage).some((value) =>
        value.includes('password123'),
      ),
    ),
    false,
  );
  for (const width of [320, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await input.fill('password123');
  mode = 'success';
  await button('회원 탈퇴').click();
  await button('탈퇴 확정').click();
  await page.getByText('탈퇴 처리 중', { exact: true }).waitFor();
  assert(await button('취소').isDisabled());
  assert.equal(await input.inputValue(), '');
  assert.equal(writes, 2);
  release();
  await page.waitForURL('**/login');
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem('growtogether.auth.v1')),
    null,
  );
  await page.getByText(/회원 탈퇴가 완료됐어요/).waitFor();
  // A separate session tests ambiguous server failure without pretending success.
  await page.goto(base + '/withdrawal');
  await input.waitFor();
  mode = 'uncertain';
  await input.fill('password123');
  await consent.click();
  await button('회원 탈퇴').click();
  await button('탈퇴 확정').click();
  await button('다시 로그인해 확인하기').waitFor();
  assert(page.url().endsWith('/withdrawal'));
  assert.equal(await button('탈퇴 확정').count(), 0);
  console.log(
    'PASS withdrawal entry, consent/cancel, password error, sensitive input lifetime, responsive layout, pending guard, success cleanup and uncertain failure',
  );
} finally {
  await browser.close();
}
