import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';

// Run against a served Expo web export. Viewport resizing does not emulate a native keyboard.
const url = process.env.CHAT_URL ?? 'http://localhost:8098';
const artifacts = process.env.ARTIFACT_DIR ?? '/tmp/grow-chat-85';
const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
await mkdir(artifacts, { recursive: true });
const browser = await engine.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
page.setDefaultTimeout(15000);
await page.addInitScript(authenticatedSessionFixture);
// The authenticated app now gates entry on a saved child profile.
await page.route('**/api/v1/children/me', (route) =>
  route.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/todos**', (route) => route.fulfill({ json: [] }));
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const input = page.getByRole('textbox', {
  name: '상담 질문 입력',
  exact: true,
});
const settings = page
  .getByTestId('chat-scroll')
  .locator('..')
  .getByRole('button', { name: '내 프로필 열기', exact: true });
const heading = page.getByRole('heading', { name: '육아 도우미' });
const tabs = page.getByRole('tablist');
const questionTab = tabs.getByRole('tab', { name: '상담', exact: true });

async function checkChat() {
  await input.waitFor();
  await page.waitForURL((address) => address.pathname === '/chat');
  assert.equal(await questionTab.getAttribute('aria-selected'), 'true');
  assert.equal(await tabs.getByRole('tab').count(), 4);
  assert.equal(
    await page
      .getByRole('heading', { name: '누구랑 같이 키워볼까요?' })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole('button', { name: '페르소나 선택으로 돌아가기' })
      .count(),
    0,
  );
}

async function checkLayout(height) {
  const title = await heading.boundingBox();
  const button = await settings.boundingBox();
  const composer = await input.boundingBox();
  const nav = await tabs.boundingBox();
  assert.ok(button.width >= 44 && button.height >= 44);
  assert.ok(title.x >= 0 && title.x + title.width <= page.viewportSize().width);
  assert.ok(button.y + button.height <= title.y);
  assert.ok(title.y >= 0 && title.y + title.height <= composer.y);
  assert.ok(composer.y + composer.height <= nav.y);
  assert.ok(nav.y + nav.height <= height);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
}

try {
  for (const [width, height] of [
    [320, 568],
    [393, 852],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${url}/chat`);
    await checkChat();
    await checkLayout(height);
    await settings.locator('img').waitFor();
    assert.ok(
      await settings.locator('img').evaluate(async (icon) => {
        await icon.decode();
        return icon.naturalWidth > 0;
      }),
    );
    assert.equal(await settings.innerText(), '');
    await page.screenshot({
      path: `${artifacts}/${engine.name()}-${width}.png`,
    });

    await input.fill('');
    const suggestion = '아이의 이런 반응을 어떻게 이해하면 좋을까?';
    await page
      .getByRole('button', { name: `질문 입력: ${suggestion}` })
      .click();
    assert.equal(await input.inputValue(), suggestion);
    await questionTab.click();
    await checkChat();
    assert.equal(
      await input.inputValue(),
      suggestion,
      'Reselect preserves draft',
    );
    await page.waitForFunction(() => {
      const intro = [...document.querySelectorAll('[dir="auto"]')].find(
        (element) => element.textContent === '이런 질문으로 시작해보세요',
      );
      const header = document.querySelector(
        '[data-testid="chat-scroll"] [role="heading"]',
      );
      return (
        intro?.getBoundingClientRect().top >=
        header?.getBoundingClientRect().bottom
      );
    });

    // Exercise reduced available height with the input focused, without claiming native IME coverage.
    await input.focus();
    await input.fill('육아에 대해 궁금해요');
    await page.setViewportSize({ width, height: 360 });
    // The title is scroll content. Focus/resize may scroll it out of view;
    // restore the inspected target before measuring the unchanged bounds.
    await heading.scrollIntoViewIfNeeded();
    await checkLayout(360);
    assert.equal(await input.inputValue(), '육아에 대해 궁금해요');
    await page.screenshot({
      path: `${artifacts}/${engine.name()}-${width}-short.png`,
    });
  }

  await page.setViewportSize({ width: 393, height: 852 });
  for (const [label, route] of [
    ['홈', '/main'],
    ['캘린더', '/calendar'],
  ]) {
    await tabs.getByRole('tab', { name: label, exact: true }).click();
    await page.waitForURL((address) => address.pathname === route);
    await questionTab.click();
    await checkChat();
  }

  await page.goto(`${url}/persona`);
  await page
    .getByRole('heading', { name: '누구랑 같이 키워볼까요?' })
    .waitFor();
  assert.equal(
    await page.getByRole('button', { name: /페르소나 선택$/ }).count(),
    3,
  );
  await page.getByRole('button', { name: '육아 도우미 페르소나 선택' }).click();
  await checkChat();

  // Simulate web safe-area padding on the chat view and its bottom tab frame.
  await page.goto(`${url}/chat`);
  await checkChat();
  await page.getByTestId('chat-scroll').evaluate((scroll) => {
    const safeArea = scroll.closest('div[style*="safe-area-inset-top"]');
    safeArea.style.paddingTop = '47px';
  });
  await page.getByTestId('floating-tab-bar-frame').evaluate((frame) => {
    const { height, paddingBottom } = getComputedStyle(frame);
    frame.style.height = `${parseFloat(height) + 34}px`;
    frame.style.paddingBottom = `${parseFloat(paddingBottom) + 34}px`;
  });
  await page.waitForFunction(() => {
    const header = document.querySelector(
      '[data-testid="chat-scroll"] [role="heading"]',
    );
    const nav = document.querySelector('[role="tablist"]');
    return (
      header?.getBoundingClientRect().top >= 47 &&
      nav?.getBoundingClientRect().bottom <= innerHeight - 34
    );
  });
  await checkLayout(852);
  assert.deepEqual(errors, []);
  console.log(
    `PASS: ${engine.name()} direct chat, all tab routes, reselect/draft, persona preservation, SVG, narrow/short layouts. Screenshots: ${artifacts}`,
  );
} catch (error) {
  await page.screenshot({ path: `${artifacts}/${engine.name()}-failure.png` });
  console.error(errors, await page.locator('body').innerText());
  throw error;
} finally {
  await browser.close();
}
