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
  let releaseReply;
  const waitForRelease = new Promise((resolve) => {
    releaseReply = resolve;
  });
  await page.route('**/api/v1/chat/generate', async (route) => {
    assert.match(route.request().headers().authorization, /^Bearer /);
    requests.push(route.request().postDataJSON());
    switch (requests.length) {
      case 1:
        await waitForRelease;
        return route.fulfill({
          json: { content: '그림책을 함께 읽어보세요.' },
        });
      case 2:
        return route.fulfill({
          status: 503,
          json: { code: 'SERVICE_UNAVAILABLE' },
        });
      default:
        return route.fulfill({
          json: { content: '좋아하는 그림을 찾아보세요.' },
        });
    }
  });
  await page.goto(`${process.env.CHAT_URL ?? 'http://127.0.0.1:8204'}/chat`);
  const input = page.getByRole('textbox', {
    name: '상담 질문 입력',
    exact: true,
  });
  const send = page.getByRole('button', { name: '질문 보내기', exact: true });
  const reset = page.getByRole('button', { name: '새 대화', exact: true });

  await input.fill('오늘 어떤 놀이를 할까요?');
  await send.click();
  await page.getByText('답변을 작성하고 있어요…', { exact: true }).waitFor();
  assert.ok(await send.isDisabled());
  assert.ok(await reset.isDisabled());
  releaseReply();
  await page
    .getByTestId('chat-message-assistant')
    .getByText('그림책을 함께 읽어보세요.')
    .waitFor();
  assert.deepEqual(requests[0], {
    message: '오늘 어떤 놀이를 할까요?',
    history: [],
  });

  await input.fill('어떻게 읽어줄까요?');
  await send.click();
  await page
    .getByText('답변을 받지 못했어요. 잠시 후 다시 보내주세요.', {
      exact: true,
    })
    .waitFor();
  assert.equal(await input.inputValue(), '어떻게 읽어줄까요?');
  assert.equal(await page.getByTestId('chat-message-user').count(), 1);
  await send.click();
  await page
    .getByTestId('chat-message-assistant')
    .getByText('좋아하는 그림을 찾아보세요.')
    .waitFor();
  assert.deepEqual(requests[1], {
    message: '어떻게 읽어줄까요?',
    history: [
      { role: 'user', content: '오늘 어떤 놀이를 할까요?' },
      { role: 'assistant', content: '그림책을 함께 읽어보세요.' },
    ],
  });
  assert.deepEqual(requests[2], requests[1]);
  await reset.click();
  await input.fill('새 질문');
  await send.click();
  await page.getByTestId('chat-message-assistant').waitFor();
  assert.deepEqual(requests[3], { message: '새 질문', history: [] });
  console.log(
    'PASS authenticated chat, pending state, reply, history, retry, and reset',
  );
} finally {
  await browser.close();
}
