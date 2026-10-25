import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(authenticatedSessionFixture);
  // Controlled viewport signals exercise the browser adapter; this is not a native keyboard test.
  await context.addInitScript(() => {
    const viewport = new EventTarget();
    Object.assign(viewport, {
      width: 393,
      height: 852,
      offsetTop: 0,
      scale: 1,
    });
    Object.defineProperty(window, 'visualViewport', { value: viewport });
  });
  const page = await context.newPage();
  await page.goto(`${process.env.CHAT_URL ?? 'http://127.0.0.1:8202'}/chat`);
  const input = page.getByRole('textbox', {
    name: '상담 질문 입력',
    exact: true,
  });
  const tabs = page.getByRole('tablist');
  await input.fill('작성 중인 질문');
  assert.ok(await tabs.isVisible(), 'Focus alone does not hide tabs');
  const resize = async (changes) => {
    await page.evaluate((changes) => {
      Object.assign(window.visualViewport, changes);
      window.visualViewport.dispatchEvent(new Event('resize'));
    }, changes);
    await page.waitForTimeout(100);
  };
  await resize({ height: 700 });
  assert.ok(
    await tabs.isVisible(),
    'Small browser chrome changes do not imply a keyboard',
  );
  await resize({ height: 390, offsetTop: 24 });
  assert.equal(await tabs.count(), 0, 'Keyboard hides chat tabs');
  const field = await input.boundingBox();
  assert.ok(
    field.y >= 24 && field.y + field.height <= 414,
    'Composer stays inside the visual viewport',
  );
  assert.equal(await input.inputValue(), '작성 중인 질문');
  await resize({ height: 852, offsetTop: 0 });
  assert.ok(await tabs.isVisible());
  assert.equal(
    await tabs
      .getByRole('tab', { name: '질문', exact: true })
      .getAttribute('aria-selected'),
    'true',
  );
  await resize({ height: 390, scale: 2 });
  assert.ok(await tabs.isVisible(), 'Pinch zoom does not imply a keyboard');
  await resize({ height: 390, scale: 1, width: 320 });
  assert.ok(
    await tabs.isVisible(),
    'Width/orientation changes do not imply a keyboard',
  );
  await resize({ height: 852, scale: 1, width: 393 });
  await tabs.getByRole('tab', { name: '홈', exact: true }).click();
  await page.waitForURL('**/main');
  await resize({ height: 390 });
  assert.ok(await tabs.isVisible(), 'Other screens keep their navigation');
  await resize({ height: 852 });
  await tabs.getByRole('tab', { name: '질문', exact: true }).click();
  await input.waitFor();
  assert.ok(await tabs.isVisible());
  const desktop = await browser.newPage({
    viewport: { width: 393, height: 852 },
  });
  await desktop.addInitScript(authenticatedSessionFixture);
  await desktop.goto(`${process.env.CHAT_URL ?? 'http://127.0.0.1:8202'}/chat`);
  await desktop
    .getByRole('textbox', { name: '상담 질문 입력', exact: true })
    .focus();
  assert.ok(await desktop.getByRole('tablist').isVisible());
  await desktop.close();
  console.log(
    'PASS: focused touch viewport keyboard signals, composer bounds, tab restoration, zoom/orientation guards and route cleanup. Native keyboards remain unverified.',
  );
} finally {
  await browser.close();
}
