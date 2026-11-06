import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Use an isolated local API/database: this creates a disposable test account.
const site = process.env.CHILDREN_URL ?? 'http://localhost:8141';
const api = process.env.CHILDREN_API_URL ?? 'http://localhost:18141';
const email = `child-${Date.now()}@example.com`;
const password = `child-${Date.now()}-password`;
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/opt/google/chrome/chrome',
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const response = await context.request.post(`${api}/api/v1/auth/signup`, {
    data: { name: '아이 연동 검증', email, password },
  });
  assert.equal(response.status(), 201);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const click = (name) =>
    page.getByRole('button', { name, exact: true }).click();
  const login = async (target) => {
    await target.goto(`${site}/login`);
    await target
      .getByRole('textbox', { name: '이메일', exact: true })
      .fill(email);
    await target.getByLabel('비밀번호', { exact: true }).fill(password);
    await target.getByRole('button', { name: '로그인', exact: true }).click();
    await target.waitForURL('**/main');
    await target.goto(`${site}/children`);
  };
  await login(page);
  await page.getByText('등록된 아이가 없어요.').waitFor();
  await click('아이 추가');
  await page
    .getByRole('textbox', { name: '아이 이름', exact: true })
    .fill('  하늘  ');
  await page
    .getByRole('textbox', { name: '생년월일', exact: true })
    .fill('2024-02-29');
  await click('저장');
  await page.getByText('하늘', { exact: true }).waitFor();
  await click('수정');
  await page
    .getByRole('textbox', { name: '아이 이름', exact: true })
    .fill('바다');
  await click('저장');
  await page.getByText('바다', { exact: true }).waitFor();
  await click('마이페이지로 돌아가기');
  await page.getByText('바다 · 2024-02-29', { exact: true }).waitFor();
  await click('로그아웃');
  await login(page);
  await page.getByText('바다', { exact: true }).waitFor();
  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  await login(second);
  await second.getByText('바다', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('바다', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  await secondContext.close();
  await context.close();
  console.log(
    'PASS live child API: register, create, edit, mypage, logout/login, second client and reload',
  );
} finally {
  await browser.close();
}
