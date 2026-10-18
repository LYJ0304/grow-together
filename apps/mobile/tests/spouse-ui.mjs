import { authenticatedSessionFixture } from './auth-fixture.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Run against a web build: npm run test:spouse -- http://localhost:8095
const siteUrl = process.argv[2] ?? 'http://localhost:8095';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});

try {
  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await page.addInitScript(authenticatedSessionFixture);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${siteUrl}/spouse`);
  const field = page.getByRole('textbox', { name: '배우자 이름' });
  const search = page.getByRole('button', { name: '검색', exact: true });
  const reset = page.getByRole('button', { name: '검색 초기화' });
  const heading = page.getByRole('heading', {
    name: '배우자 찾기',
    exact: true,
  });
  await heading.waitFor();
  // Wait for hydration before interacting with an exported static page.
  await page.waitForFunction(() =>
    Object.keys(document.querySelector('input')).some((key) =>
      key.startsWith('__reactProps'),
    ),
  );
  await page.getByText('검색하면 이곳에 결과가 표시돼요.').waitFor();
  await page.getByText('예시 데이터로 둘러보기').waitFor();
  await field.fill('   ');
  await search.click();
  await page.getByRole('alert').waitFor();
  assert.equal(await field.inputValue(), '');
  await field.fill('  민준  ');
  await search.click();
  await page.getByRole('heading', { name: '검색 결과 2명' }).waitFor();
  assert.equal(await field.inputValue(), '민준');
  await page.getByText('김민준', { exact: true }).waitFor();
  await page.getByText('이민준', { exact: true }).waitFor();
  assert.equal(await page.getByRole('alert').count(), 0);
  await page.getByText('예시 ID · sample-001').waitFor();
  await page.getByText('예시 ID · sample-003').waitFor();
  await field.fill('김서연');
  await field.press('Enter');
  await page.getByRole('heading', { name: '검색 결과 1명' }).waitFor();
  await page.getByText('김서연', { exact: true }).waitFor();
  assert.equal(await page.getByText('김민준', { exact: true }).count(), 0);
  await field.fill('없는이름');
  await search.click();
  await page.getByText('검색 결과가 없어요', { exact: true }).waitFor();
  await page.getByRole('heading', { name: '검색 결과 0명' }).waitFor();
  await reset.click();
  assert.equal(await field.inputValue(), '');
  assert(await field.evaluate((element) => document.activeElement === element));
  await page.getByText('검색하면 이곳에 결과가 표시돼요.').waitFor();
  await search.click();
  await page.getByRole('alert').waitFor();
  await reset.click();
  assert.equal(await page.getByRole('alert').count(), 0);

  // Keyboard-only submission and a long query must remain usable at 320px.
  await field.fill('김');
  await field.press('Tab');
  assert(
    await search.evaluate((element) => document.activeElement === element),
  );
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: '검색 결과 2명' }).waitFor();
  await field.fill('가'.repeat(120));
  await search.click();
  await page.getByText('검색 결과가 없어요', { exact: true }).waitFor();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    'Search UI must fit a narrow viewport even with a long query',
  );
  await page.screenshot({ path: '/tmp/spouse-ui-narrow.png', fullPage: true });
  await page.reload();
  await heading.waitFor();
  await page.getByText('검색하면 이곳에 결과가 표시돼요.').waitFor();
  assert.equal(await field.inputValue(), '');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: '/tmp/spouse-ui-desktop.png', fullPage: true });
  assert.deepEqual(errors, [], 'Screen must not produce runtime errors');
  console.log(
    'PASS spouse route/reload, empty input, partial/exact search, trimming, keyboard submission, no results, reset/focus, narrow layout and runtime errors',
  );
} finally {
  await browser.close();
}
