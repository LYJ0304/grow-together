import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page.setDefaultNavigationTimeout(300000);
  await page.addInitScript(authenticatedSessionFixture);
  await page.route('**/api/v1/chat/generate', (route) =>
    route.fulfill({ json: { content: '그림책을 함께 읽어보세요.' } }),
  );
  await page.goto(`${process.env.CHAT_URL ?? 'http://localhost:8101'}/chat`);
  const input = page.getByRole('textbox', {
    name: '상담 질문 입력',
    exact: true,
  });
  await input.waitFor({ timeout: 300000 });
  assert.ok(
    await input.evaluate(
      (el) => parseFloat(getComputedStyle(el).fontSize) >= 16,
    ),
    'Input text must be at least 16px',
  );
  assert.equal(await input.evaluate((el) => el.tagName), 'TEXTAREA');
  const send = page.getByRole('button', { name: '질문 보내기', exact: true });
  assert.ok(await send.isDisabled());
  await input.fill('   ');
  assert.ok(await send.isDisabled());
  await page
    .getByRole('button', {
      name: '질문 입력: 오늘 집에서 할 놀이를 추천해줘',
      exact: true,
    })
    .click();
  assert.ok(await input.evaluate((el) => el === document.activeElement));
  assert.equal(await input.inputValue(), '오늘 집에서 할 놀이를 추천해줘');
  const box = await send.boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44);
  await input.fill('첫 줄');
  await page.waitForFunction(
    () =>
      document.querySelector('textarea').getBoundingClientRect().height <= 48,
  );
  const short = (await input.boundingBox()).height;
  const shortBox = (await page.getByTestId('chat-composer').boundingBox())
    .height;
  assert.ok(
    await input.evaluate((element) => {
      const { paddingTop, paddingBottom, lineHeight } =
        getComputedStyle(element);
      const contentHeight =
        element.clientHeight -
        parseFloat(paddingTop) -
        parseFloat(paddingBottom);
      return (
        paddingTop === paddingBottom && contentHeight >= parseFloat(lineHeight)
      );
    }),
    'A single line fits with symmetric padding',
  );
  await input.fill('자동 줄바꿈이 되는 긴 질문을 입력해요. '.repeat(6));
  await page.waitForFunction(
    (initialHeight) =>
      document.querySelector('textarea').clientHeight > initialHeight,
    short,
  );
  assert.ok(
    (await page.getByTestId('chat-composer').boundingBox()).height > shortBox,
  );
  await input.fill('첫 줄');

  await input.press('Shift+Enter');
  await input.pressSequentially('둘째 줄');
  assert.equal(await input.inputValue(), '첫 줄\n둘째 줄');
  await page.waitForFunction(
    () =>
      document.querySelector('textarea')?.getBoundingClientRect().height > 48,
  );
  assert.ok((await input.boundingBox()).height > short);
  await input.press('Enter');
  assert.equal(await input.inputValue(), '');
  assert.equal(
    await page.getByTestId('chat-message-user').innerText(),
    '첫 줄\n둘째 줄',
  );
  assert.ok(await input.evaluate((el) => el === document.activeElement));
  const composed = await input.evaluate((el) => {
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  });
  assert.equal(composed, false, 'IME Enter must not be handled as send');
  await input.fill('긴 질문\n'.repeat(25));
  await page.waitForFunction(
    () =>
      document.querySelector('textarea').scrollHeight >
      document.querySelector('textarea').clientHeight,
  );
  assert.ok((await input.boundingBox()).height <= 144);
  assert.ok(
    await input.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop > 0;
    }),
    'Long content scrolls inside the capped input',
  );

  await input.fill('짧은 질문');
  await page.waitForFunction(
    () =>
      document.querySelector('textarea').getBoundingClientRect().height <= 48,
  );
  await page.setViewportSize({ width: 320, height: 360 });
  await page.waitForFunction(
    () => document.documentElement.scrollWidth <= innerWidth,
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  // A touch browser keeps Return for newline, rather than desktop Enter-to-send.
  const mobile = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  });
  await mobile.addInitScript(authenticatedSessionFixture);
  const touch = await mobile.newPage();
  await touch.goto(`${process.env.CHAT_URL ?? 'http://localhost:8101'}/chat`);
  const mobileInput = touch.getByRole('textbox', {
    name: '상담 질문 입력',
    exact: true,
  });
  await mobileInput.fill('모바일 질문');
  await mobileInput.press('Enter');
  assert.equal(await mobileInput.inputValue(), '모바일 질문\n');
  await mobile.close();
  console.log(
    'PASS: readable multiline composer, growing/shrinking height, desktop/mobile keys, IME, focus and disabled send.',
  );
} finally {
  await browser.close();
}
