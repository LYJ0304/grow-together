import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: ['--no-sandbox'],
});
const artifacts = `/tmp/growtogether-160/${process.env.VISUAL_PHASE ?? 'after'}`;
await mkdir(artifacts, { recursive: true });
try {
  const page = await browser.newPage({
    reducedMotion: 'reduce',
    timezoneId: 'Asia/Seoul',
  });
  page.setDefaultTimeout(15000);
  await page.addInitScript(authenticatedSessionFixture);
  await page.clock.setFixedTime(new Date('2026-11-09T12:00:00+09:00'));
  await page.route('**/api/v1/children/me', (r) =>
    r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
  );
  await page.route('**/api/v1/todos**', (r) =>
    r.fulfill({
      json: [
        {
          id: 1,
          planName: '그림책을 함께 읽어요',
          content: '좋아하는 그림을 찾아 이야기 나눠요.',
          scheduledDate: '2026-11-09',
          scheduledTime: '09:00:00',
          completed: false,
        },
        {
          id: 2,
          planName: '가을 산책',
          content: '아이와 천천히 걸어요.',
          scheduledDate: '2026-11-09',
          scheduledTime: '16:00:00',
          completed: false,
        },
      ],
    }),
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [width, height] of process.env.TAB_ONLY
    ? [[844, 390]]
    : [
        [320, 700],
        [390, 844],
        [844, 390],
      ]) {
    await page.setViewportSize({ width, height });
    for (const route of process.env.TAB_ONLY
      ? ['main']
      : [
          'main',
          'todo',
          'calendar',
          'chat',
          'mypage',
          'diary?date=2026-11-09',
          'children',
          'spouse',
          'persona',
        ]) {
      await page.goto(
        `${process.env.MOBILE_URL ?? 'http://localhost:8160'}/${route}`,
      );
      await page.getByRole('heading').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (route === 'main') {
        await page
          .getByRole('heading', { name: '하늘의 하루 · 22개월', exact: true })
          .waitFor();
        await page.getByTestId('home-schedule-row').first().waitFor();
      }
      if (route === 'todo') {
        await page
          .getByRole('button', {
            name: '그림책을 함께 읽어요 메뉴',
            exact: true,
          })
          .waitFor();
      }
      if (route === 'children') {
        await page.getByRole('button', { name: '수정', exact: true }).waitFor();
      }
      await page.screenshot({
        path: `${artifacts}/${width}-${route.split('?')[0]}.png`,
        fullPage: true,
      });
      if (route === 'children') {
        await page.getByRole('button', { name: '수정', exact: true }).click();
        await page
          .getByRole('textbox', { name: '아이 이름', exact: true })
          .waitFor();
        await page.screenshot({
          path: `${artifacts}/${width}-children-edit.png`,
          fullPage: true,
        });
      }
      if (process.env.VISUAL_PHASE !== 'before') {
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${route}: horizontal overflow`,
        );
        if (!['main', 'todo', 'calendar', 'chat'].includes(route)) continue;
        const tabs = page.getByRole('tablist').getByRole('tab');
        assert.equal(await tabs.count(), 5);
        for (const tab of await tabs.all()) {
          const box = await tab.boundingBox();
          assert(box.height >= 48 && box.width >= 44, 'tab touch target');
          const icon = await tab.locator('img:visible').first().boundingBox();
          const label = await tab
            .getByText(await tab.getAttribute('aria-label'), { exact: true })
            .boundingBox();
          assert(
            icon.y + icon.height <= label.y + 1,
            `${width}: tab label must be below its icon`,
          );
          assert(
            Math.abs(icon.x + icon.width / 2 - label.x - label.width / 2) < 2,
            'centered tab label',
          );
        }
      }
      if (route === 'todo') {
        await page
          .getByRole('button', { name: '＋ 직접 추가', exact: true })
          .click();
        await page
          .getByRole('textbox', { name: '계획명', exact: true })
          .waitFor();
        await page.screenshot({
          path: `${artifacts}/${width}-plan.png`,
          fullPage: true,
        });
      }
    }
  }
  const authPage = await browser.newPage();
  for (const width of [320, 390]) {
    await authPage.setViewportSize({ width, height: 844 });
    for (const route of ['login', 'signup']) {
      await authPage.goto(
        `${process.env.MOBILE_URL ?? 'http://localhost:8160'}/${route}`,
      );
      await authPage.getByRole('textbox').first().waitFor();
      await authPage.screenshot({
        path: `${artifacts}/${width}-${route}.png`,
        fullPage: true,
      });
    }
  }
  await authPage.close();
  assert.deepEqual(errors, []);
  console.log(`Visual polish checks passed; captures: ${artifacts}`);
} finally {
  await browser.close();
}
