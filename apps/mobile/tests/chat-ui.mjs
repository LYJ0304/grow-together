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
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const input = page.getByRole('textbox', {
  name: '상담 질문 입력',
  exact: true,
});
const settings = page.getByRole('button', { name: '상담 설정', exact: true });
const heading = page.getByRole('heading', { name: '차분한 상담선생님' });
const tabs = page.getByRole('tablist');
const questionTab = tabs.getByRole('tab', { name: '질문', exact: true });

async function checkChat() {
  await input.waitFor();
  assert.equal(new URL(page.url()).pathname, '/chat');
  assert.equal(await questionTab.getAttribute('aria-selected'), 'true');
  assert.equal(await tabs.getByRole('tab').count(), 5);
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
  assert.ok(title.x + title.width <= button.x);
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
    await page.waitForFunction(() => {
      const icon = document.querySelector('[aria-label="상담 설정"] img');
      return icon?.complete && icon.naturalWidth > 0;
    });
    assert.equal(await settings.innerText(), '');
    await page.screenshot({
      path: `${artifacts}/${engine.name()}-${width}.png`,
    });

    const suggestion = '편식이 심한데 어쩌죠?';
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
        (element) => element.textContent === '이 시기에는 이런 질문이 많아요',
      );
      const header = document.querySelector('[role="heading"]');
      return (
        intro?.getBoundingClientRect().top >=
        header?.getBoundingClientRect().bottom
      );
    });

    // Exercise reduced available height with the input focused, without claiming native IME coverage.
    await input.focus();
    await input.fill('육아에 대해 궁금해요');
    await page.setViewportSize({ width, height: 360 });
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
    ['투두', '/todo'],
    ['마이', '/mypage'],
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
  await page
    .getByRole('button', { name: '차분한 상담선생님 페르소나 선택' })
    .click();
  await checkChat();

  // Probe the installed safe-area provider without claiming device notch coverage.
  await page.goto(`${url}/chat`);
  await checkChat();
  await page.addStyleTag({
    content:
      'body > div[style*="safe-area-inset-top"] { padding-top: 47px !important; padding-bottom: 34px !important; }',
  });
  await page.waitForFunction(() => {
    const header = document.querySelector('[role="heading"]');
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
