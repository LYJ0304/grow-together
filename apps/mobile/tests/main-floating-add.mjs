import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ reducedMotion: 'reduce' });
page.setDefaultTimeout(12000);
await page.addInitScript(authenticatedSessionFixture);
await page.route('**/api/v1/children/me', (route) =>
  route.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/todos**', (route) => route.fulfill({ json: [] }));
await page.route('**/api/v1/diary**', (route) =>
  route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } }),
);
const artifacts = '/tmp/grow-floating-add';
await mkdir(artifacts, { recursive: true });
const base = process.env.MOBILE_URL ?? 'http://localhost:8199';
const cta = page.getByRole('button', {
  name: '오늘 이야기 나누기',
  exact: true,
});
// Locate the actual scrolling viewport, without depending on component wrappers.
const scrollState = (node, position) => {
  let scroll = node.parentElement;
  while (
    scroll &&
    !['auto', 'scroll'].includes(getComputedStyle(scroll).overflowY)
  )
    scroll = scroll.parentElement;
  if (!scroll) throw new Error('Main scroll viewport missing');
  if (position === 'end') scroll.scrollTop = scroll.scrollHeight;
  if (typeof position === 'number') scroll.scrollTop = position;
  const rect = scroll.getBoundingClientRect();
  return { bottom: rect.bottom, top: rect.top, scrollTop: scroll.scrollTop };
};
try {
  for (const [width, height] of [
    [320, 700],
    [390, 844],
    [430, 844],
    [844, 390],
    [1024, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${base}/main`, { timeout: 120000 });
    await page.getByText('하늘의 하루', { exact: false }).waitFor();
    await cta.waitFor();
    const fab = page.getByRole('button', {
      name: '선택한 날 일기 작성하기',
      exact: true,
    });
    const button = await fab.boundingBox();
    const nav = await page.getByRole('tablist').boundingBox();
    const viewport = await cta.evaluate(scrollState, 'end');
    await page.screenshot({
      path: `${artifacts}/${process.env.VISUAL_PHASE ?? 'after'}-${width}.png`,
    });
    assert(
      viewport.bottom >= button.y + button.height,
      'Main content must extend behind the floating button instead of reserving a full-width row',
    );
    assert(button.y + button.height < nav.y, 'Button stays above navigation');
    assert(button.width >= 44 && button.height >= 44);
    assert(
      Math.abs(
        button.x + button.width - (width / 2 + Math.min(width, 600) / 2 - 20),
      ) < 2,
      'Button follows the content right edge on mobile and tablet',
    );
    const last = await cta.boundingBox();
    assert(
      last.y >= viewport.top && last.y + last.height < button.y,
      'The last action can scroll completely above the floating button',
    );
    const x = last.x + 20;
    const y = button.y + button.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -120);
    await page.waitForFunction(
      (old) => {
        const node = document.elementFromPoint(old.x, old.y);
        let parent = node;
        while (
          parent &&
          !['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)
        )
          parent = parent.parentElement;
        return parent && parent.scrollTop < old.top;
      },
      { x, y, top: viewport.scrollTop },
    );
    const current = await cta.evaluate(scrollState);
    const action = await cta.boundingBox();
    await cta.evaluate(
      scrollState,
      current.scrollTop + action.y + action.height / 2 - y,
    );
    await page.screenshot({ path: `${artifacts}/overlay-${width}.png` });
    await page.mouse.click(x, y);
    await page.waitForURL('**/chat?**');
    await page.getByRole('tab', { name: '오늘', exact: true }).click();
    await fab.click();
    await page
      .getByRole('heading', { name: '무엇을 남길까요?', exact: true })
      .waitFor();
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  console.log(
    'PASS floating-only button, full-height scroll viewport, row hit testing/wheel, last action clearance, quick add and responsive alignment',
  );
} finally {
  await browser.close();
}
