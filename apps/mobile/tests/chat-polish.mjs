import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';

const url = process.env.CHAT_URL ?? 'http://127.0.0.1:18375';
const artifacts = process.env.ARTIFACT_DIR ?? '/tmp/grow-chat-polish';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
await page.addInitScript(authenticatedSessionFixture);
const input = page.getByRole('textbox', {
  name: '상담 질문 입력',
  exact: true,
});
const send = page.getByRole('button', { name: '질문 보내기', exact: true });
const cards = page.getByRole('button', { name: /^질문 입력:/ });

function contrast(first, second) {
  const luminance = (color) => {
    const channels = color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number);
    return channels.reduce((total, channel, index) => {
      const value = channel / 255;
      const linear =
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      return total + linear * [0.2126, 0.7152, 0.0722][index];
    }, 0);
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

async function fits(height) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const field = await input.boundingBox();
  const button = await send.boundingBox();
  const tabs = await page.getByRole('tablist').boundingBox();
  assert.ok(field.y >= 0 && field.y + field.height <= tabs.y);
  assert.ok(button.width >= 44 && button.height >= 44);
  assert.ok(button.y >= field.y && button.y + button.height <= tabs.y);
  assert.ok(tabs.y + tabs.height <= height);
}

try {
  await page.goto(`${url}/chat`);
  await input.waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.doesNotMatch(
    await input.evaluate((node) => getComputedStyle(node).fontFamily),
    /Jua/,
    'Writing uses the existing readable body font',
  );
  assert.equal(await cards.count(), 3);
  await page.getByText('이런 질문으로 시작해보세요', { exact: true }).waitFor();
  const preview = cards
    .first()
    .getByText('지금 여유 있는 시간과 준비물을 적어보세요.', { exact: true });
  const colors = await preview.evaluate((node) => ({
    text: getComputedStyle(node).color,
    background: getComputedStyle(node.closest('[role="button"]'))
      .backgroundColor,
  }));
  assert.ok(
    contrast(colors.text, colors.background) >= 4.5,
    'Card description contrast',
  );
  const hint = await input.evaluate((node) => ({
    text: getComputedStyle(node, '::placeholder').color,
    background: getComputedStyle(node.parentElement).backgroundColor,
    opacity: getComputedStyle(node, '::placeholder').opacity,
  }));
  assert.equal(Number(hint.opacity), 1);
  assert.ok(
    contrast(hint.text, hint.background) >= 4.5,
    'Placeholder contrast',
  );
  const border = () =>
    input.evaluate((node) => getComputedStyle(node.parentElement).borderColor);
  await input.blur();
  const restingBorder = await border();
  await input.focus();
  assert.notEqual(await border(), restingBorder, 'Visible input focus');
  for (const width of [320, 393, 768]) {
    await page.setViewportSize({ width, height: 852 });
    await input.fill('');
    await fits(852);
    await page.screenshot({ path: `${artifacts}/chat-${width}.png` });
  }
  await input.fill('긴 질문을 작성합니다.\n'.repeat(20));
  await page.waitForFunction(
    () =>
      document.querySelector('textarea').scrollHeight >
      document.querySelector('textarea').clientHeight,
  );
  const field = await input.boundingBox();
  const button = await send.boundingBox();
  assert.ok(
    Math.abs(field.y + field.height - button.y - button.height) <= 8,
    'Send stays near the bottom of multiline input',
  );
  await page.setViewportSize({ width: 320, height: 400 });
  await send.click();
  await fits(400);
  await page
    .getByText('질문을 작성했어요. AI 답변 기능은 준비 중이에요.', {
      exact: true,
    })
    .waitFor();
  await page.screenshot({ path: `${artifacts}/chat-long-short.png` });
  await page.addStyleTag({
    content:
      '[dir="auto"], textarea { font-size: 24px !important; line-height: 36px !important; }',
  });
  await fits(400);
  assert.equal(await input.inputValue(), '');
  await page.getByRole('button', { name: '앱 설정', exact: true }).click();
  await page.waitForURL('**/mypage');
  await page
    .getByRole('button', { name: '이전 화면으로', exact: true })
    .click();
  await input.waitFor();
  await fits(400);
  await page.screenshot({ path: `${artifacts}/chat-large-text.png` });
  console.log(
    'PASS: readable typography, contrast, focus, three cards, multiline send alignment, narrow/short/large-text layout.',
  );
} finally {
  await browser.close();
}
