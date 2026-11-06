import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Run against a staging web export with no API URL or auth bypass override.
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : {}),
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const errors = [];
  const apiRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiRequests.push(request.url());
  });
  await page.goto(`${process.argv[2] ?? 'http://localhost:8135'}/login`);
  await page
    .getByRole('heading', { name: '다시 만났네요!', exact: true })
    .waitFor();
  await page
    .getByRole('textbox', { name: '이메일', exact: true })
    .fill('qa@example.com');
  await page.getByLabel('비밀번호', { exact: true }).fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page
    .getByText('API 연결이 설정되지 않았어요. 미리보기를 이용해 주세요.', {
      exact: true,
    })
    .waitFor();
  await page.getByRole('button', { name: '인증 없이 미리보기 진입' }).click();
  await page.waitForURL('**/main');
  await page.getByTestId('main-screen').waitFor();
  assert.deepEqual(apiRequests, []);
  assert.deepEqual(errors, []);
  console.log(
    'Staging without API: login error, preview entry, no API requests or page errors passed',
  );
} finally {
  await browser.close();
}
