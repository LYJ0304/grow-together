import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 320, height: 700 },
  reducedMotion: 'reduce',
});
await page.addInitScript(authenticatedSessionFixture);
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
await page.route('**/api/v1/diary**', (r) => r.fulfill({ json: [] }));
const base = process.env.MOBILE_URL ?? 'http://localhost:8193';
const labels = ['오늘', '일정', '기록', '리포트', '질문'];
try {
  await page.goto(base + '/main', { timeout: 120000 });
  await page.getByRole('tablist').waitFor();
  const tabs = page.getByRole('tablist').getByRole('tab');
  assert.deepEqual(
    await tabs.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute('aria-label')),
    ),
    labels,
  );
  await page.screenshot({ path: '/tmp/floating-tabs-initial.png' });
  assert.deepEqual(
    (await tabs.allTextContents()).map((text) => text.trim()),
    labels,
    'Every floating tab shows its label',
  );
  for (const [width, height] of [
    [320, 700],
    [390, 844],
    [844, 390],
    [1024, 900],
  ]) {
    await page.setViewportSize({ width, height });
    for (const tab of await tabs.all()) {
      const box = await tab.boundingBox();
      assert(box.width >= 44 && box.height >= 44);
      const icon = tab.locator('img').first();
      await icon.waitFor();
      const b = await icon.boundingBox();
      const label = await tab
        .getByText(await tab.getAttribute('aria-label'), { exact: true })
        .boundingBox();
      assert(
        b.y >= box.y && b.y + b.height <= label.y,
        'Icon sits above its visible label',
      );
      assert(
        label.y + label.height <= box.y + box.height,
        'Label stays inside its touch target',
      );
    }
    const nav = await page.getByRole('tablist').boundingBox();
    assert(
      nav.x >= 16 && nav.x + nav.width <= width - 16,
      'Pill has side gutters',
    );
    assert(nav.width <= 520, 'Pill stays compact on wide screens');
    assert(
      nav.y + nav.height <= height - 10,
      'Pill floats above the bottom edge',
    );
    const active = await page
      .getByTestId('floating-tab-highlight')
      .boundingBox();
    const selected = await page
      .getByRole('tablist')
      .getByRole('tab', { selected: true })
      .boundingBox();
    assert.equal(Math.round(active.height), 70);
    assert(
      Math.abs(
        active.x + active.width / 2 - (selected.x + selected.width / 2),
      ) < 1,
    );
    assert(active.y < nav.y && active.y + active.height > nav.y + nav.height);
    assert.equal(Math.round(nav.height), 56);
    await page.screenshot({ path: `/tmp/floating-tabs-${width}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addStyleTag({
    content:
      'body > div[style*="safe-area-inset-top"] { padding-top: 47px !important; padding-bottom: 34px !important; }',
  });
  await page.waitForFunction(
    () =>
      Math.round(
        document
          .querySelector('[data-testid="floating-tab-bar-frame"]')
          .getBoundingClientRect().height,
      ) === 114,
  );
  const keyboardTab = page.getByRole('tab', { name: '리포트', exact: true });
  await keyboardTab.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/report');
  for (const [name, route] of [
    ['일정', 'todo'],
    ['기록', 'calendar'],
    ['리포트', 'report'],
    ['질문', 'chat'],
    ['오늘', 'main'],
  ]) {
    const tab = page.getByRole('tab', { name, exact: true });
    await tab.click();
    await page.waitForURL('**/' + route);
    assert.equal(await tab.getAttribute('aria-selected'), 'true');
    const active = await page
      .getByTestId('floating-tab-highlight')
      .boundingBox();
    const selected = await tab.boundingBox();
    assert(
      Math.abs(
        active.x + active.width / 2 - (selected.x + selected.width / 2),
      ) < 1,
      'Reduced motion settles the highlight on the selected tab',
    );
    assert(await tab.getAttribute('href'), 'Tabs preserve web links');
  }
  assert.deepEqual(
    (await tabs.allTextContents()).map((text) => text.trim()),
    labels,
  );
  const animated = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'no-preference',
  });
  await animated.addInitScript(authenticatedSessionFixture);
  await animated.route('**/api/v1/children/me', (r) =>
    r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
  );
  await animated.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
  await animated.goto(base + '/main');
  const highlight = animated.getByTestId('floating-tab-highlight');
  await highlight.waitFor();
  await animated.waitForFunction(
    () =>
      window.matchMedia('(prefers-reduced-motion: reduce)').matches === false,
  );
  await animated.evaluate(() => {
    window.highlightFrames = [];
    window.highlightSampling = true;
    const sample = () => {
      if (!window.highlightSampling) return;
      const element = document.querySelector(
        '[data-testid="floating-tab-highlight"]',
      );
      if (element)
        window.highlightFrames.push(element.getBoundingClientRect().x);
      requestAnimationFrame(sample);
    };
    sample();
  });
  const startX = (await highlight.boundingBox()).x;
  await animated.getByRole('tab', { name: '질문', exact: true }).click();
  await animated.waitForURL('**/chat');
  await animated.waitForFunction(() => {
    const bar = document
      .querySelector('[data-testid="floating-tab-highlight"]')
      .getBoundingClientRect();
    const tab = document
      .querySelector('[role="tab"][aria-selected="true"]')
      .getBoundingClientRect();
    return Math.abs(bar.x + bar.width / 2 - tab.x - tab.width / 2) < 1;
  });
  const endX = (await highlight.boundingBox()).x;
  const frames = await animated.evaluate(() => {
    window.highlightSampling = false;
    return window.highlightFrames;
  });
  assert(endX > startX + 100, 'Highlight travels to the selected tab');
  assert(
    frames.some((x) => x > startX + 2 && x < endX - 2),
    'Motion renders intermediate positions',
  );
  await animated.emulateMedia({ reducedMotion: 'reduce' });
  await animated.getByRole('tab', { name: '오늘', exact: true }).click();
  await animated.waitForURL('**/main');
  await animated.waitForFunction(
    (start) =>
      Math.abs(
        document
          .querySelector('[data-testid="floating-tab-highlight"]')
          .getBoundingClientRect().x - start,
      ) < 1,
    startX,
  );
  // Modified link clicks retain browser navigation without changing this tab's route.
  const popupPromise = animated.context().waitForEvent('page');
  await animated
    .getByRole('tab', { name: '질문', exact: true })
    .click({ modifiers: ['Control'] });
  const popup = await popupPromise;
  await popup.waitForURL('**/chat');
  assert(animated.url().endsWith('/main'));
  await popup.close();
  await animated.close();
  console.log(
    'PASS floating pill, visible labels, five links/selected states, keyboard navigation, moving highlight, 44px targets, safe area and responsive gutters',
  );
} catch (error) {
  await page.screenshot({ path: '/tmp/floating-tabs-failure.png' });
  throw error;
} finally {
  await browser.close();
}
