import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';

const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const base = process.env.MOBILE_URL ?? 'http://localhost:8156';
const page = await browser.newPage({ reducedMotion: 'reduce' });
await page.addInitScript(authenticatedSessionFixture);
await page.route('**/api/v1/children/me', (route) =>
  route.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/todos**', (route) => route.fulfill({ json: [] }));
await page.route('**/api/v1/diary**', (route) =>
  route.fulfill(
    new URL(route.request().url()).searchParams.has('month')
      ? { json: [] }
      : { status: 404, json: { code: 'NOT_FOUND' } },
  ),
);
const profile = () =>
  page.getByRole('button', { name: '아이 프로필 열기', exact: true });
const settings = () =>
  page.getByRole('button', { name: '앱 설정', exact: true });
async function appearance() {
  await profile().waitFor();
  return profile().evaluate((button) => {
    const style = getComputedStyle(button);
    const sibling = button.nextElementSibling;
    return {
      width: button.getBoundingClientRect().width,
      height: button.getBoundingClientRect().height,
      radius: style.borderRadius,
      border: style.border,
      background: style.backgroundColor,
      gap:
        sibling.getBoundingClientRect().left -
        button.getBoundingClientRect().right,
    };
  });
}
try {
  for (const width of [320, 390, 430, 1200]) {
    await page.setViewportSize({ width, height: 568 });
    await page.goto(`${base}/todo`);
    const expected = await appearance();
    await page.goto(`${base}/main`);
    assert.deepEqual(
      await appearance(),
      expected,
      `Shared buttons at ${width}px`,
    );
    assert.equal(await profile().count(), 1);
    assert.equal(await settings().count(), 1);
    for (const name of ['이전 날', '다음 날']) {
      const alignment = await page
        .getByRole('button', { name, exact: true })
        .evaluate((button) => {
          const icon = button.querySelector('img');
          if (!icon) return null;
          const circle = button.getBoundingClientRect();
          const image = icon.getBoundingClientRect();
          return {
            x: image.x + image.width / 2 - (circle.x + circle.width / 2),
            y: image.y + image.height / 2 - (circle.y + circle.height / 2),
            text: button.textContent,
          };
        });
      assert(alignment, `${name} uses an SVG icon`);
      assert(
        Math.abs(alignment.x) < 1 && Math.abs(alignment.y) < 1,
        `${name} is centered`,
      );
      assert.equal(alignment.text, '', 'Arrow has no font-dependent text');
    }

    const heading = page.getByTestId('home-day-heading');
    const before = await settings().boundingBox();
    const distance = await heading.evaluate((node) => {
      let parent = node.parentElement;
      while (parent) {
        if (
          ['auto', 'scroll'].includes(getComputedStyle(parent).overflowY) &&
          parent.scrollHeight > parent.clientHeight
        ) {
          const before = parent.scrollTop;
          parent.scrollTop = 80;
          return parent.scrollTop - before;
        }
        parent = parent.parentElement;
      }
      return 0;
    });
    assert(distance > 0, 'Exercise actual home scrolling');
    await page.waitForFunction(
      ({ y, distance }) => {
        const button = document.querySelector('[aria-label="앱 설정"]');
        return Math.abs(button.getBoundingClientRect().y - (y - distance)) < 1;
      },
      { y: before.y, distance },
    );
  }
  await page.goto(`${base}/main`);
  await page.getByRole('button', { name: '이전 날', exact: true }).click();
  await page.getByRole('button', { name: '다음 날', exact: true }).click();
  assert(
    await page
      .getByRole('button', { name: '다음 날', exact: true })
      .isDisabled(),
  );
  await profile().click();
  await page.waitForURL('**/children');
  await page.goto(`${base}/main`);
  await settings().click();
  await page.waitForURL('**/mypage');
  console.log(
    'PASS shared header buttons, preserved home scrolling, date navigation and destinations',
  );
} finally {
  await browser.close();
}
