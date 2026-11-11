import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const base = process.env.MOBILE_URL ?? 'http://localhost:8181';
const context = await browser.newContext({
  viewport: { width: 390, height: 760 },
  reducedMotion: 'reduce',
});
await context.addInitScript(authenticatedSessionFixture);
const page = await context.newPage();
page.setDefaultTimeout(15000);
let mode = 'error',
  reads = [];
await page.route('**/api/v1/children/me', (r) => {
  const subject = JSON.parse(
    atob(r.request().headers().authorization.split('.')[1]),
  ).sub;
  reads.push(subject);
  if (mode === 'network') return r.abort('failed');
  if (mode === 'error') return r.fulfill({ status: 500, json: {} });
  if (mode === 'unauthorized') return r.fulfill({ status: 401, json: {} });
  return r.fulfill({ status: 404, json: {} });
});
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
await page.route('**/api/v1/auth/logout', (r) => r.fulfill({ status: 204 }));
const token = (subject) => ({
  accessToken: `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ iss: 'growtogether-api', sub: subject }))}.ui-test`,
  refreshToken: 'refresh-2',
  tokenType: 'Bearer',
  expiresIn: 900,
});
await page.route('**/api/v1/auth/login', (r) =>
  r.fulfill({ json: token('2') }),
);
const click = (name) => page.getByRole('button', { name, exact: true }).click();
const missing = () =>
  page.getByRole('dialog', { name: '우리 아이를 등록해주세요', exact: true });
try {
  await page.goto(base + '/main', { timeout: 120000 });
  await page
    .getByRole('alert')
    .filter({ hasText: '아이 정보를 불러오지 못했어요.' })
    .waitFor();
  assert.equal(await missing().count(), 0, '500 must not mean missing');
  mode = 'network';
  await click('아이 정보 다시 시도');
  await page.waitForTimeout(300);
  assert.equal(
    await missing().count(),
    0,
    'Network error must not mean missing',
  );
  await page.getByRole('tab', { name: '일정', exact: true }).click();
  await click('활동 추천받기');
  await page
    .getByRole('dialog', { name: '아이 정보를 확인하지 못했어요', exact: true })
    .waitFor();
  assert.equal(
    await missing().count(),
    0,
    'Feature check failure needs a distinct retry state',
  );
  mode = 'missing';
  await click('아이 정보 다시 확인');
  await missing().waitFor();
  await click('나중에 등록하기');
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  assert.equal(await missing().count(), 0);
  await click('앱 설정');
  await click('로그아웃');
  await page.getByRole('textbox', { name: '이메일', exact: true }).waitFor();
  await page
    .getByRole('textbox', { name: '이메일', exact: true })
    .fill('parent2@example.com');
  await page.getByLabel('비밀번호', { exact: true }).fill('Password123!');
  await click('로그인');
  await missing().waitFor();
  assert.equal(reads.at(-1), '2', 'New account must query its own profile');
  await click('나중에 등록하기');
  mode = 'unauthorized';
  await page.reload();
  await page.getByRole('textbox', { name: '이메일', exact: true }).waitFor();
  assert.equal(
    await missing().count(),
    0,
    'Authentication failure must not show registration',
  );
  console.log(
    'PASS server/network/auth errors, feature retry, dismissal and account-change prompt reset',
  );
} catch (error) {
  console.error(await page.locator('body').innerText());
  throw error;
} finally {
  await context.close();
  await browser.close();
}
