import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await page.addInitScript(authenticatedSessionFixture);
  await page.route('**/api/v1/children/me', (route) =>
    route.fulfill({ status: 404, json: {} }),
  );
  const requests = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) requests.push(request.url());
  });
  await page.goto(`${process.env.CHAT_URL ?? 'http://127.0.0.1:8204'}/chat`);
  const input = page.getByRole('textbox', {
    name: '상담 질문 입력',
    exact: true,
  });
  await input.waitFor();
  assert.equal(
    await page.getByText('Online', { exact: false }).count(),
    0,
    'No fake online status',
  );
  assert.ok(
    await page.getByText('현재 연결 준비 중', { exact: true }).isVisible(),
  );
  assert.equal(
    await page.getByRole('button', { name: '음성 입력', exact: true }).count(),
    0,
  );
  await input.fill('질문을 작성했습니다');
  await page.getByRole('button', { name: '질문 보내기', exact: true }).click();
  const notice = page.getByText(
    '질문을 작성했어요. AI 답변 기능은 준비 중이에요.',
    { exact: true },
  );
  await notice.waitFor();
  assert.equal(await input.inputValue(), '');
  assert.equal(
    await page.getByTestId('chat-message-user').innerText(),
    '질문을 작성했습니다',
  );
  assert.ok(await input.evaluate((el) => el === document.activeElement));
  await input.press('Enter');
  assert.equal(
    await page.getByTestId('chat-message-user').count(),
    1,
    'Empty Enter never adds a message',
  );
  await page.getByRole('button', { name: '앱 설정', exact: true }).click();
  await page.waitForURL('**/mypage');
  await page.getByRole('heading', { name: '설정', exact: true }).waitFor();
  await page
    .getByRole('button', { name: '이전 화면으로', exact: true })
    .click();
  await page.waitForURL('**/chat');
  await input.focus();
  assert.equal(await input.inputValue(), '');
  assert.equal(await page.getByTestId('chat-message-user').count(), 1);
  assert.ok(await input.evaluate((el) => el === document.activeElement));
  await page.setViewportSize({ width: 320, height: 360 });
  await input.fill('짧은 화면에서 작성한 질문');
  await page.getByRole('button', { name: '질문 보내기', exact: true }).click();
  await notice.scrollIntoViewIfNeeded();
  assert.ok(await notice.isVisible());
  const field = await input.boundingBox();
  const tabs = await page.getByRole('tablist').boundingBox();
  assert.ok(field.y + field.height <= tabs.y);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.equal(
    requests.filter(
      (url) =>
        !['/api/v1/auth/refresh', '/api/v1/children/me'].includes(
          new URL(url).pathname,
        ),
    ).length,
    0,
    'No fake chat/voice API call',
  );
  console.log(
    'PASS: honest readiness, local message/settings navigation, focus, preserved conversation, no voice button or fake chat requests.',
  );
} finally {
  await browser.close();
}
