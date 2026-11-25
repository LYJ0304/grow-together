import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 844 } });
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(120000);
await page.addInitScript(authenticatedSessionFixture);
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/users/me', (r) =>
  r.fulfill({ json: { id: 1, name: '보호자', email: 'parent@example.test' } }),
);
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
await page.route('**/api/v1/diary**', (r) =>
  r.fulfill({ status: 404, json: {} }),
);
const base = process.env.MOBILE_URL ?? 'http://localhost:8290';
try {
  await page.goto(base + '/main');
  await page.getByRole('tab', { name: '마이', exact: true }).click();
  await page.waitForURL('**/mypage');
  await page
    .getByRole('button', { name: '아이 정보 관리', exact: true })
    .click();
  await page.waitForURL('**/children');
  await page
    .getByRole('button', { name: '이전 화면으로 돌아가기', exact: true })
    .click();
  await page.waitForURL('**/mypage');
  await page.getByRole('tab', { name: '홈', exact: true }).click();
  await page.waitForURL('**/main');
  await page
    .getByRole('button', { name: '오늘 이야기 나누기', exact: true })
    .click();
  await page.waitForURL('**/chat**');
  const input = page.getByRole('textbox', {
    name: '상담 질문 입력',
    exact: true,
  });
  await input.fill('홈에서 이어 쓸 질문 초안');
  await page.getByRole('tab', { name: '홈', exact: true }).click();
  await page
    .getByRole('button', { name: '오늘 이야기 나누기', exact: true })
    .click();
  assert.equal(await input.inputValue(), '홈에서 이어 쓸 질문 초안');
  assert.equal(await page.getByRole('tab').count(), 4);
  console.log(
    'PASS mypage/child navigation via bottom tab and chat draft preserved without top profile row',
  );
} finally {
  await browser.close();
}
