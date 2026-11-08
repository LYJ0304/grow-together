import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
await mkdir('/tmp/growtogether-156', { recursive: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(authenticatedSessionFixture);
  await page.route('**/api/v1/children/me', (r) =>
    r.fulfill({
      json: {
        name: '아주아주긴아이이름으로화면넘침확인',
        birthday: '2025-01-01',
      },
    }),
  );
  await page.route('**/api/v1/todos**', (r) =>
    r.fulfill({
      json: [
        {
          id: 1,
          planName:
            '함께 책장을 넘겨 보며 좋아하는 그림을 찾아보는 긴 이름의 활동',
          content: '준비한 그림책을 함께 펼쳐요. '.repeat(8),
          scheduledDate: '2026-11-08',
          scheduledTime: '09:00:00',
          completed: true,
        },
      ],
    }),
  );
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    for (const route of [
      'main',
      'todo',
      'calendar',
      'chat',
      'diary?date=2026-11-08',
    ]) {
      await page.goto(
        `${process.env.MOBILE_URL ?? 'http://localhost:8156'}/${route}`,
        { waitUntil: 'commit', timeout: 120000 },
      );
      await page.getByRole('tablist').waitFor();
      assert.equal(await page.getByRole('tablist').getByRole('tab').count(), 4);
      const expected = {
        main: '오늘',
        todo: '일정',
        calendar: '기록',
        chat: '질문',
        diary: '기록',
      }[route.split('?')[0]];
      assert.equal(
        await page
          .getByRole('tablist')
          .getByRole('tab', { selected: true })
          .getAttribute('aria-label'),
        expected,
      );
      for (const tab of await page
        .getByRole('tablist')
        .getByRole('tab')
        .all()) {
        const box = await tab.boundingBox();
        assert(box.height >= 44 && box.width >= 44);
      }
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        'No horizontal overflow',
      );
      await page.screenshot({
        path: `/tmp/growtogether-156/${width}-${route.split('?')[0]}.png`,
      });
    }
  }
  await page
    .getByRole('button', { name: '직접 작성하기', exact: true })
    .click();
  const editor = page.getByRole('textbox', {
    name: '일기 본문 수정',
    exact: true,
  });
  await editor.fill('긴 본문을 작성하고 있어요.\n'.repeat(80));
  await page.setViewportSize({ width: 320, height: 360 });
  await editor.focus();
  await page
    .getByRole('button', { name: '수정 완료', exact: true })
    .scrollIntoViewIfNeeded();
  const done = await page
    .getByRole('button', { name: '수정 완료', exact: true })
    .boundingBox();
  const nav = await page.getByRole('tablist').boundingBox();
  assert(done.y + done.height <= nav.y + 1);
  await page.getByRole('button', { name: '수정 완료', exact: true }).click();
  await page.addStyleTag({
    content:
      '[dir="auto"] {font-size:24px !important; line-height:36px !important;}',
  });
  await page
    .getByRole('button', { name: '이 일기 저장하기', exact: true })
    .scrollIntoViewIfNeeded();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: '/tmp/growtogether-156/large-text-long-diary.png',
  });
  await page
    .getByRole('button', { name: '초안 다시 정리', exact: true })
    .click();
  for (const label of ['취소', '교체하고 다시 정리']) {
    const action = page.getByRole('button', { name: label, exact: true });
    await action.scrollIntoViewIfNeeded();
    const bounds = await action.boundingBox();
    assert(
      bounds.y >= 0 && bounds.y + bounds.height <= 360,
      'Large text modal actions remain reachable',
    );
  }
  await page.getByRole('button', { name: '취소', exact: true }).click();
  assert.deepEqual(errors, []);
  console.log(
    'PASS 320/390 layouts, touch targets, long names/body, large text and reduced keyboard viewport; screenshots /tmp/growtogether-156',
  );
} finally {
  await browser.close();
}
