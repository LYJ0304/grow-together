import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 320, height: 700 },
  timezoneId: 'America/Los_Angeles',
  reducedMotion: 'reduce',
});
await page.addInitScript(authenticatedSessionFixture);
await page.clock.setFixedTime(new Date('2026-11-15T15:00:00Z'));
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
const calls = [];
page.on('request', (r) => {
  if (r.url().includes('/reports')) calls.push(r.url());
});
const base = process.env.MOBILE_URL ?? 'http://localhost:8183';
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(base + '/main', { timeout: 120000 });
  await page.getByRole('tablist').waitFor();
  assert.deepEqual(
    await page
      .getByRole('tab')
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('aria-label')),
      ),
    ['오늘', '일정', '기록', '리포트', '질문'],
  );
  await page.getByRole('tab', { name: '리포트', exact: true }).click();
  await page.getByRole('heading', { name: '리포트', exact: true }).waitFor();
  await page.getByText('11월 16일 – 11월 22일', { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: '다음 주', exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole('button', { name: '이전 주', exact: true }).click();
  await page.getByText('11월 9일 – 11월 15일', { exact: true }).waitFor();
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  await page.getByRole('tab', { name: '리포트', exact: true }).click();
  await page.getByText('11월 9일 – 11월 15일', { exact: true }).waitFor();
  await page.getByRole('button', { name: '다음 주', exact: true }).click();
  await page.getByText('리포트를 준비하고 있어요', { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: 'AI 이야기 만들기', exact: true })
      .count(),
    0,
    'Unconnected screen must not pretend AI is available',
  );
  for (const [width, height] of [
    [320, 700],
    [390, 844],
    [844, 390],
    [1024, 900],
  ]) {
    await page.setViewportSize({ width, height });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    for (const tab of await page.getByRole('tab').all()) {
      const box = await tab.boundingBox();
      assert(box.width >= 44 && box.height >= 44);
    }
    await page.screenshot({ path: `/tmp/report183-${width}.png` });
  }
  await page
    .getByRole('button', { name: '일정 확인하기', exact: true })
    .click();
  await page.waitForURL('**/todo');
  await page.getByRole('tab', { name: '리포트', exact: true }).click();
  await page.getByRole('button', { name: '기록 남기기', exact: true }).click();
  await page.waitForURL('**/calendar');
  assert.deepEqual(
    calls,
    [],
    'Draft must not invent an API contract or silently fetch mock data',
  );
  assert.deepEqual(errors, []);
  const preview = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  try {
    await preview.goto(base + '/login');
    await preview
      .getByRole('button', { name: '인증 없이 미리보기 진입', exact: true })
      .click();
    await preview.getByRole('tab', { name: '리포트', exact: true }).click();
    await preview
      .getByRole('heading', {
        name: '로그인하고 기록을 돌아보세요',
        exact: true,
      })
      .waitFor();
    await preview
      .getByRole('button', { name: '로그인하러 가기', exact: true })
      .click();
    await preview
      .getByRole('textbox', { name: '이메일', exact: true })
      .waitFor();
  } finally {
    await preview.close();
  }
  console.log(
    'PASS five tabs, Seoul week browsing, retained week, existing screen links, preview login, unavailable boundary, no invented calls and 320/390/landscape/wide layouts',
  );
} finally {
  await browser.close();
}
