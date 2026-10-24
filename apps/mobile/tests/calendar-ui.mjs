import { authenticatedSessionFixture } from './auth-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright-core';

// Serve an Expo web export first; development error overlays can cover navigation.
// BROWSER=webkit exercises WebKit. BROWSER_EXECUTABLE_PATH supports a local browser.
const url = process.env.CALENDAR_URL ?? 'http://localhost:8094';
const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
const artifacts = process.env.ARTIFACT_DIR ?? '/tmp/growtogether-calendar-43';
await mkdir(artifacts, { recursive: true });
const browser = await engine.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  timezoneId: 'Asia/Seoul',
});
await context.addInitScript(() => {
  localStorage.setItem(
    '@growtogether/diary/v1/2026-10-10',
    JSON.stringify({
      date: '2026-10-10',
      content: '캘린더 회귀 검증용 일기',
      emotions: [],
      growthPoints: [],
      photoUris: [],
    }),
  );
  const originalKey = Storage.prototype.key;
  Storage.prototype.key = function (index) {
    if (window.diaryStorageUnavailable) throw new Error('Storage unavailable');
    return originalKey.call(this, index);
  };
});
const page = await context.newPage();
await page.addInitScript(authenticatedSessionFixture);
page.setDefaultTimeout(15000);
const grid = page.getByTestId('calendar-grid');
const weeks = page.getByTestId('calendar-week');
const heading = page.getByRole('heading');
const tabs = page.getByRole('tablist');
const create = page.getByRole('button', {
  name: '선택한 날짜의 일기 생성하기',
});
const view = page.getByRole('button', { name: '선택한 날짜의 일기 보기' });

async function open(date) {
  await page.goto(`${url}/calendar?date=${date}`);
  await grid.waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[role="button"]')].some(
      (button) =>
        button.textContent === '일기 보기' ||
        button.textContent === '일기 생성하기',
    ),
  );
}

try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [430, 932],
  ]) {
    await page.setViewportSize({ width, height });
    await open('2026-10-10');
    assert.equal(await weeks.count(), 5);
    assert.equal(await grid.getByRole('button').count(), 35);
    assert.equal(await heading.innerText(), '2026년 10월');
    assert.equal(await grid.getByRole('button', { pressed: true }).count(), 1);
    const first = await weeks.first().getByRole('button').first().boundingBox();
    assert.ok(first.width >= 43.9 && first.height >= 48);
    const cells = await weeks.first().getByRole('button').all();
    for (const cell of cells) {
      const box = await cell.boundingBox();
      assert.ok(Math.abs(box.width - first.width) < 1);
      assert.equal(box.y, first.y);
    }
    const columns = await weeks
      .first()
      .getByRole('button')
      .evaluateAll((items) =>
        items.map((item) => item.getBoundingClientRect().x),
      );
    const allCells = await grid.getByRole('button').all();
    for (const [index, cell] of allCells.entries()) {
      const box = await cell.boundingBox();
      assert.ok(Math.abs(box.width - first.width) < 1);
      assert.ok(Math.abs(box.x - columns[index % 7]) < 1);
    }
    const title = await heading.boundingBox();
    const legend = await page
      .getByText('● 일기가 저장된 날', { exact: true })
      .boundingBox();
    const button = await view.boundingBox();
    const navigation = await tabs.boundingBox();
    assert.ok(title.y < 40, 'Content starts near the safe top');
    assert.ok(button.y - legend.y - legend.height <= 24);
    assert.ok(button.height >= 48 && button.height <= 54);
    assert.ok(button.y + button.height <= navigation.y);
    assert.ok(navigation.y + navigation.height <= height);
    assert.deepEqual(
      await tabs
        .getByRole('tab')
        .evaluateAll((items) =>
          items.map((item) => item.getAttribute('aria-label')),
        ),
      ['캘린더', '투두', '홈', '질문', '마이'],
    );
    assert.equal(
      await tabs
        .getByRole('tab', { selected: true })
        .getAttribute('aria-label'),
      '캘린더',
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: path.join(artifacts, `${engine.name()}-${width}.png`),
    });
    // Viewport height changes (browser chrome) must not move the CTA away from its legend.
    await page.setViewportSize({ width, height: height - 100 });
    const resized = await view.boundingBox();
    assert.equal(resized.y, button.y);
  }

  await page.setViewportSize({ width: 320, height: 568 });
  for (const [date, count] of [
    ['2026-02-15', 4],
    ['2026-08-15', 6],
    ['2028-02-29', 5],
  ]) {
    await open(date);
    assert.equal(await weeks.count(), count);
  }
  await open('2026-08-15');
  const headerBefore = await heading.boundingBox();
  const navBefore = await tabs.boundingBox();
  await page.getByRole('button', { name: '다음 달', exact: true }).click();
  assert.equal(await weeks.count(), 5);
  assert.equal((await heading.boundingBox()).y, headerBefore.y);
  assert.equal((await tabs.boundingBox()).y, navBefore.y);
  await page.getByRole('button', { name: '이전 달', exact: true }).click();
  assert.equal(await weeks.count(), 6);

  await open('2026-12-31');
  await page.getByRole('button', { name: '다음 달', exact: true }).click();
  assert.equal(await heading.innerText(), '2027년 1월');
  await open('2026-10-10');
  await page
    .getByRole('button', { name: '2026년 9월 30일', exact: true })
    .click();
  assert.equal(await heading.innerText(), '2026년 9월');
  await create.click();
  assert.ok(new URL(page.url()).searchParams.get('date') === '2026-09-30');
  assert.ok(new URL(page.url()).searchParams.get('mode') === 'create');

  await open('2026-10-10');
  await view.focus();
  await page.keyboard.press('Enter');
  await page.getByText('캘린더 회귀 검증용 일기', { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('mode'), 'view');
  await page
    .getByRole('button', { name: '캘린더로 돌아가기', exact: true })
    .click();
  await view.waitFor();

  // Exercise the existing create/save/return flow through the redesigned CTA.
  await page
    .getByRole('button', { name: '2026년 10월 11일', exact: true })
    .click();
  await create.click();
  await page.getByRole('button', { name: '다음으로', exact: true }).click();
  await page
    .getByRole('button', { name: '일기 생성하기', exact: true })
    .click();
  await page.getByRole('button', { name: '다음으로', exact: true }).click();
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await view.waitFor();
  await page.getByText('일기를 저장했어요.', { exact: true }).waitFor();
  assert.equal(
    await grid
      .getByRole('button', { pressed: true })
      .getAttribute('aria-label'),
    '2026년 10월 11일, 일기 있음',
  );

  await page.evaluate(() => {
    window.diaryStorageUnavailable = true;
  });
  await page.getByRole('tab', { name: '홈', exact: true }).click();
  await page.getByRole('tab', { name: '캘린더', exact: true }).click();
  await page
    .getByRole('button', { name: '일기 목록 다시 불러오기', exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: /선택한 날짜의 일기/ })
      .getAttribute('aria-disabled'),
    'true',
  );
  await page.evaluate(() => {
    window.diaryStorageUnavailable = false;
  });
  await page
    .getByRole('button', { name: '일기 목록 다시 불러오기', exact: true })
    .click();
  await page.waitForFunction(
    () => !document.querySelector('[role="button"][aria-disabled="true"]'),
  );

  for (const [label, route] of [
    ['투두', '/todo'],
    ['홈', '/main'],
    ['질문', '/chat'],
    ['마이', '/mypage'],
    ['캘린더', '/calendar'],
  ]) {
    await page.getByRole('tab', { name: label, exact: true }).click();
    await page.waitForURL((address) => address.pathname === route);
    assert.equal(
      await tabs
        .getByRole('tab', { selected: true })
        .getAttribute('aria-label'),
      label,
    );
    assert.equal(await tabs.getByRole('tab').count(), 5);
    const box = await tabs.boundingBox();
    assert.ok(box.y + box.height <= 568);
  }

  await open('2026-08-15');
  await page.addStyleTag({
    content: `
    [data-testid="calendar-grid"] [role="button"] > div:first-child { font-size: 30px !important; line-height: 40px !important; }
    [role="heading"] { font-size: 44px !important; line-height: 56px !important; }
  `,
  });
  await create.scrollIntoViewIfNeeded();
  const action = await create.boundingBox();
  const nav = await tabs.boundingBox();
  assert.ok(
    action.y + action.height <= nav.y,
    'Large text CTA scrolls above navigation',
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: path.join(artifacts, `${engine.name()}-large-text.png`),
  });
  await page.getByRole('tab', { name: '캘린더', exact: true }).click();
  await page.waitForFunction(() => {
    const heading = document.querySelector('[role="heading"]');
    return heading && heading.getBoundingClientRect().top >= 0;
  });

  // Simulate notch/home-indicator insets through the installed provider's CSS probe.
  // This verifies layout integration, not actual iOS standalone/browser chrome behavior.
  await page.setViewportSize({ width: 390, height: 844 });
  await open('2026-10-10');
  await page.addStyleTag({
    content: `body > div[style*="safe-area-inset-top"] { padding-top: 47px !important; padding-bottom: 34px !important; }`,
  });
  await page.waitForFunction(() => {
    const heading = document.querySelector('[role="heading"]');
    const navigation = document.querySelector('[role="tablist"]');
    return (
      heading?.getBoundingClientRect().top >= 47 &&
      navigation?.getBoundingClientRect().bottom <= innerHeight - 34
    );
  });
  assert.ok(
    (await view.boundingBox()).y + (await view.boundingBox()).height <
      (await tabs.boundingBox()).y,
  );
  await page.screenshot({
    path: path.join(artifacts, `${engine.name()}-safe-area.png`),
  });
  console.log(
    `PASS: ${engine.name()} mobile layouts, 4/5/6 weeks, month/date navigation, diary create/view/save, retry, tab routes, keyboard, large text, simulated safe area. Screenshots: ${artifacts}`,
  );
} catch (error) {
  await page.screenshot({
    path: path.join(artifacts, `${engine.name()}-failure.png`),
  });
  console.error(await page.locator('body').innerText());
  throw error;
} finally {
  await browser.close();
}
