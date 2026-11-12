import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
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
const base = process.env.MOBILE_URL ?? 'http://localhost:8187';
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
  assert(
    (await tabs.allTextContents()).every((text) => text.trim() === ''),
    'Bottom tabs must show icons without visible labels',
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
      assert(
        Math.abs(b.y + b.height / 2 - (box.y + box.height / 2)) < 2,
        `Icon must be vertically centered: ${JSON.stringify({ box, icon: b })}`,
      );
    }
    const nav = await page.getByRole('tablist').locator('..').boundingBox();
    assert.equal(Math.round(nav.height), 56);
    await page.screenshot({ path: `/tmp/icon-tabs-${width}.png` });
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
          .querySelector('[role="tablist"]')
          .parentElement.getBoundingClientRect().height,
      ) === 90,
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
  }
  assert((await tabs.allTextContents()).every((text) => text.trim() === ''));
  console.log(
    'PASS icon-only tabs, five accessible names/selected states, navigation, 44px targets, centered icons and 56px bar across viewports',
  );
} catch (error) {
  await page.screenshot({ path: '/tmp/icon-tabs-failure.png' });
  throw error;
} finally {
  await browser.close();
}
