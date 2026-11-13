import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(15000);
await page.addInitScript(authenticatedSessionFixture);
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const chatRequests = [];
page.on('request', (r) => {
  if (/\/api\/.*chat/.test(r.url())) chatRequests.push(r.url());
});
const base = process.env.CHAT_URL ?? 'http://localhost:8217';
const input = page.getByRole('textbox', {
  name: '상담 질문 입력',
  exact: true,
});
const send = page.getByRole('button', { name: '질문 보내기', exact: true });
await mkdir('/tmp/grow-chat-messages', { recursive: true });
try {
  await page.goto(`${base}/chat`);
  await input.fill('   ');
  assert(await send.isDisabled());
  await page
    .getByRole('button', {
      name: '질문 입력: 오늘 집에서 할 놀이를 추천해줘',
      exact: true,
    })
    .click();
  assert.equal(await input.inputValue(), '오늘 집에서 할 놀이를 추천해줘');
  const content = '우리 아이의 하루\n어떤 놀이가 좋을까요?';
  await input.fill(content);
  await send.click();
  await page.getByTestId('chat-message-user').waitFor();
  assert.equal(
    await page.getByTestId('chat-message-user').innerText(),
    content,
  );
  assert.equal(await input.inputValue(), '');
  assert(await send.isDisabled());
  assert.equal(
    await page.getByRole('button', { name: /^질문 입력:/ }).count(),
    0,
  );
  assert.equal(await page.getByTestId('chat-message-assistant').count(), 0);
  await page
    .getByText('질문을 작성했어요. AI 답변 기능은 준비 중이에요.', {
      exact: true,
    })
    .waitFor();
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  assert.equal(
    await page.getByTestId('chat-message-user').innerText(),
    content,
  );
  for (let i = 0; i < 12; i++) {
    await input.fill(`질문 ${i}\n${'길게 작성한 질문입니다. '.repeat(8)}`);
    await send.click();
  }
  const last = page.getByTestId('chat-message-user').last();
  await page.waitForFunction(() => {
    const nodes = document.querySelectorAll(
      '[data-testid="chat-message-user"]',
    );
    const last = nodes[nodes.length - 1].getBoundingClientRect();
    return (
      last.bottom <=
      document.querySelector('textarea').getBoundingClientRect().top
    );
  });
  const list = page.getByTestId('chat-scroll');
  await list.evaluate((el) => {
    el.scrollTop = 20;
    el.dispatchEvent(new Event('scroll'));
  });
  const before = await list.evaluate((el) => el.scrollTop);
  await input.fill('이전 대화를 읽는 중의 초안');
  assert.equal(
    await list.evaluate((el) => el.scrollTop),
    before,
    'Typing does not jump the reading position',
  );
  await send.click();
  await page.getByText('이전 대화를 읽는 중의 초안', { exact: true }).waitFor();
  for (const width of [320, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: 640 });
    await input.fill('줄바꿈없는긴문장'.repeat(80));
    await send.click();
    await last.scrollIntoViewIfNeeded();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const bubble = await last.boundingBox();
    assert(bubble.x >= 0 && bubble.x + bubble.width <= width);
    await page.screenshot({
      path: `/tmp/grow-chat-messages/conversation-${width}.png`,
    });
  }
  await input.fill('초기화할 초안');
  await page.getByRole('button', { name: '새 대화', exact: true }).click();
  assert.equal(await page.getByTestId('chat-message-user').count(), 0);
  assert.equal(await input.inputValue(), '');
  await page
    .getByRole('button', { name: /^질문 입력:/ })
    .first()
    .waitFor();
  assert.deepEqual(chatRequests, []);
  assert.deepEqual(errors, []);
  assert.equal(await page.getByRole('progressbar').count(), 0);
  console.log(
    'PASS local messages, multiline/long content, empty/conversation/reset, tab retention, scroll, no fake AI or chat requests',
  );
} finally {
  await browser.close();
}
