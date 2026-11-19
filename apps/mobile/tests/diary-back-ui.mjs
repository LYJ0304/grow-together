import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
});
page.setDefaultTimeout(8000);
await page.addInitScript(authenticatedSessionFixture);
await page.clock.setFixedTime(new Date('2026-11-19T12:00:00+09:00'));
await page.route('**/api/v1/diary**', (r) =>
  r.fulfill(
    new URL(r.request().url()).searchParams.has('month')
      ? { json: [] }
      : { status: 404, json: {} },
  ),
);
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2024-01-01' } }),
);
const base = process.env.MOBILE_URL ?? 'http://localhost:8281';
const back = () =>
  page.getByRole('button', { name: '기록으로 돌아가기', exact: true });
try {
  await page.goto(base + '/diary?date=2026-11-18');
  await page.getByRole('textbox', { name: '일기 본문', exact: true }).waitFor();
  await mkdir('/tmp/diary-back-shots', { recursive: true });
  await page.screenshot({
    path: process.env.BACK_BASELINE
      ? '/tmp/diary-back-shots/before.png'
      : '/tmp/diary-back-shots/after.png',
  });
  assert.equal(
    (await back().innerText()).trim(),
    '',
    'back has an accessible label but no visible text',
  );
  for (const width of [320, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    const geometry = await back().evaluate((node) => {
      const icon = node.querySelector('img');
      const header = node.closest('[data-testid="app-header"]');
      const box = node.getBoundingClientRect();
      return {
        inside: !!header,
        width: box.width,
        height: box.height,
        left: box.x,
        headerLeft: header?.getBoundingClientRect().x,
        icon: icon
          ? {
              width: icon.getBoundingClientRect().width,
              height: icon.getBoundingClientRect().height,
            }
          : null,
        border: getComputedStyle(node).borderTopWidth,
        background: getComputedStyle(node).backgroundColor,
      };
    });
    assert(geometry.inside, 'one existing AppHeader owns navigation');
    assert(geometry.width >= 44 && geometry.height >= 44);
    assert.equal(geometry.left, geometry.headerLeft + 20);
    assert.equal(geometry.icon.width, 24);
    assert.equal(geometry.icon.height, 24);
    assert.equal(geometry.border, '0px');
    assert.equal(geometry.background, 'rgba(0, 0, 0, 0)');
    const header = await back().evaluate((node) => {
        const rect = node
          .closest('[data-testid="app-header"]')
          .getBoundingClientRect();
        return { y: rect.y, height: rect.height };
      }),
      date = await page
        .getByText('2026년 11월 18일 수요일', { exact: true })
        .boundingBox();
    assert(
      date.y - header.y - header.height <= 24,
      'removed full-width button leaves no empty row',
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const input = page.getByRole('textbox', { name: '일기 본문', exact: true });
  await input.fill('기록으로 돌아가도 유지할 초안');
  await back().focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/calendar**');
  assert(
    (await page.getByTestId('calendar-selection').innerText()).includes(
      '11월 18일',
    ),
    'calendar consumes the date param into its selected-day state',
  );
  await page
    .getByRole('button', { name: '작성하던 일기 이어 쓰기', exact: true })
    .click();
  assert.equal(await input.inputValue(), '기록으로 돌아가도 유지할 초안');
  assert.equal(new URL(page.url()).searchParams.get('date'), '2026-11-18');
  await input.fill('긴 기록\n'.repeat(120));
  const before = await back().boundingBox();
  await page
    .getByRole('button', { name: '일기 저장하기', exact: true })
    .scrollIntoViewIfNeeded();
  assert.equal(
    (await back().boundingBox()).y,
    before.y,
    'header stays outside the scrolling editor',
  );
  await page.setViewportSize({ width: 320, height: 360 });
  assert((await back().boundingBox()).y >= 0);
  const history = await page.evaluate(() => window.history.length);
  await back().evaluate((node) => {
    node.click();
    node.click();
  });
  await page.waitForURL('**/calendar**');
  assert(
    (await page.evaluate(() => window.history.length)) <= history,
    'rapid back activation does not push a new route',
  );
  console.log(
    'PASS icon-only diary back, shared header, 44px targets, compact spacing, responsive/short viewport, keyboard activation, date/draft retention and no added route on rapid back',
  );
} finally {
  await browser.close();
}
