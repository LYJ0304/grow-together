import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const phase = process.env.VISUAL_PHASE ?? 'after';
const directory = `/tmp/grow-editorial/${phase}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  timezoneId: 'Asia/Seoul',
  reducedMotion: 'reduce',
});
await page.addInitScript(authenticatedSessionFixture);
await page.clock.setFixedTime(new Date('2026-11-12T12:00:00+09:00'));
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({
    json: {
      name: '보람',
      birthday: '2025-01-01',
      personalization: {
        prematurityStatus: 'no',
        expectedDueDate: null,
        concerns: ['communication'],
        availableActivityTime: '10min',
        developmentObservations: [],
      },
    },
  }),
);
await page.route('**/api/v1/todos**', (r) =>
  r.fulfill({
    json: [
      {
        id: 1,
        planName: '그림책 읽기',
        content: '함께 그림을 찾아봐요.',
        scheduledDate: '2026-11-12',
        scheduledTime: '09:30:00',
        durationMinutes: 20,
        completed: true,
      },
      {
        id: 2,
        planName: '블록 놀이',
        content: '집에 있는 블록을 사용해요.',
        scheduledDate: '2026-11-12',
        scheduledTime: '14:00:00',
        durationMinutes: 15,
        completed: false,
      },
    ],
  }),
);
await page.route('**/api/v1/diary**', (r) =>
  new URL(r.request().url()).searchParams.has('month')
    ? r.fulfill({ json: [{ id: 8, diaryDate: '2026-11-11' }] })
    : r.fulfill({ status: 404, json: { code: 'NOT_FOUND' } }),
);
try {
  for (const width of phase === 'before' ? [390] : [320, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: width === 320 ? 700 : 844 });
    for (const [name, route] of [
      ['today', 'main'],
      ['schedule', 'todo'],
      ['records', 'calendar'],
      ['diary', 'diary?date=2026-11-12'],
      ['report', 'report'],
      ['chat', 'chat'],
      ['onboarding', 'onboarding?edit=true'],
      ['profile', 'children'],
      ['settings', 'mypage'],
    ]) {
      await page.goto(
        `${process.env.MOBILE_URL ?? 'http://localhost:8197'}/${route}`,
        { timeout: 120000 },
      );
      await page.getByRole('heading').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(800);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width} ${name}: horizontal overflow`,
      );
      await page.screenshot({
        path: `${directory}/${width}-${name}.png`,
        fullPage: false,
      });
    }
  }
  console.log(
    `PASS captured eight app screens plus settings at four widths: ${directory}`,
  );
} finally {
  await browser.close();
}
