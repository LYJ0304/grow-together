import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(12000);
await page.clock.setFixedTime(new Date('2026-11-13T10:00:00Z'));
await page.addInitScript(authenticatedSessionFixture);
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/diary**', (r) => r.fulfill({ json: [] }));
let todo = {
  id: 41,
  planName: '산책',
  scheduledDate: '2026-11-13',
  scheduledTime: '09:00:00',
  completed: false,
  childReaction: null,
};
let expired = false,
  secondAccount = false;
let failReaction = false,
  failCompletion = false;
let writes = 0,
  hold,
  release;
await page.route('**/api/v1/todos**', async (r) => {
  const req = r.request();
  if (req.method() === 'GET')
    return r.fulfill({ json: secondAccount ? [] : [todo] });
  const body = req.postDataJSON();
  if (req.url().endsWith('/completion')) {
    if (failCompletion) return r.fulfill({ status: 500, json: {} });
    todo = {
      ...todo,
      completed: body.completed,
      childReaction: body.completed ? todo.childReaction : null,
    };
  } else if (req.url().endsWith('/reaction')) {
    writes++;
    if (expired) return r.fulfill({ status: 401, json: {} });
    if (hold) await hold;
    if (failReaction) return r.fulfill({ status: 500, json: {} });
    todo = { ...todo, childReaction: body.childReaction };
  }
  return r.fulfill({ json: todo });
});
await page.addInitScript(() => {
  const fetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (
      window.expiredReactionSession &&
      new URL(String(input), location.href).pathname === '/api/v1/auth/refresh'
    )
      return Promise.resolve(
        new Response('{}', {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    return fetch(input, init);
  };
});
await page.route('**/api/v1/auth/login', (r) => {
  secondAccount = true;
  return r.fulfill({
    json: {
      accessToken: `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ iss: 'growtogether-api', sub: '2' })).toString('base64url')}.ui-test`,
      refreshToken: 'second-refresh',
      tokenType: 'Bearer',
      expiresIn: 900,
    },
  });
});
const base = process.env.MOBILE_URL ?? 'http://localhost:8218';
const heading = page.getByRole('heading', {
  name: '아이의 반응은 어땠나요?',
  exact: true,
});
const choose = (name) => page.getByRole('radio', { name, exact: true });
try {
  await page.goto(`${base}/main`);
  await page.getByRole('checkbox', { name: '산책 완료', exact: true }).click();
  await heading.waitFor();
  await choose('좋아했어요').click();
  await page
    .getByRole('button', { name: '반응 저장하기', exact: true })
    .click();
  await heading.waitFor({ state: 'hidden' });
  assert.equal(todo.childReaction, 'ENJOYED');
  await page.getByRole('tab', { name: '일정', exact: true }).click();
  await page
    .getByRole('button', { name: '산책 반응 수정', exact: true })
    .click();
  assert.equal(await choose('좋아했어요').getAttribute('aria-checked'), 'true');
  await choose('어려워했어요').click();
  failReaction = true;
  await page
    .getByRole('button', { name: '반응 저장하기', exact: true })
    .click();
  await page.getByRole('alert').filter({ hasText: '반응' }).waitFor();
  assert.equal(todo.childReaction, 'ENJOYED');
  assert.equal(
    await choose('어려워했어요').getAttribute('aria-checked'),
    'true',
  );
  failReaction = false;
  await page
    .getByRole('button', { name: '반응 저장하기', exact: true })
    .click();
  await heading.waitFor({ state: 'hidden' });
  assert.equal(todo.childReaction, 'DIFFICULT');
  await page.reload();
  await page
    .getByRole('button', { name: '산책 반응 수정', exact: true })
    .click();
  assert.equal(
    await choose('어려워했어요').getAttribute('aria-checked'),
    'true',
  );
  await page.getByRole('button', { name: '반응 지우기', exact: true }).click();
  await heading.waitFor({ state: 'hidden' });
  assert.equal(todo.childReaction, null);
  await page
    .getByRole('button', { name: '산책 반응 기록', exact: true })
    .click();
  await page.getByRole('button', { name: '나중에', exact: true }).click();
  assert.equal(todo.completed, true);
  await page
    .getByRole('button', { name: '산책 반응 기록', exact: true })
    .click();
  await choose('보통이에요').click();
  hold = new Promise((resolve) => {
    release = resolve;
  });
  const before = writes;
  await page
    .getByRole('button', { name: '반응 저장하기', exact: true })
    .click();
  assert(
    await page
      .getByRole('button', { name: '저장 중…', exact: true })
      .isDisabled(),
  );
  assert(
    await page
      .getByRole('button', { name: '나중에', exact: true })
      .isDisabled(),
  );
  release();
  hold = null;
  await heading.waitFor({ state: 'hidden' });
  assert.equal(writes, before + 1);
  assert.equal(todo.childReaction, 'NEUTRAL');
  await page
    .getByRole('checkbox', { name: '산책 완료 취소', exact: true })
    .click();
  await page
    .getByRole('checkbox', { name: '산책 완료', exact: true })
    .waitFor();
  assert.equal(todo.childReaction, null);
  failCompletion = true;
  await page.getByRole('checkbox', { name: '산책 완료', exact: true }).click();
  await page.getByText(/완료 상태를 저장하지 못했어요/).waitFor();
  assert.equal(await heading.count(), 0);
  failCompletion = false;
  await page.getByRole('checkbox', { name: '산책 완료', exact: true }).click();
  await heading.waitFor();
  await mkdir('/tmp/grow-reaction-206', { recursive: true });
  for (const width of [320, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: 640 });
    await page
      .getByRole('button', { name: '나중에', exact: true })
      .scrollIntoViewIfNeeded();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `/tmp/grow-reaction-206/modal-${width}.png`,
    });
  }
  await page.getByRole('button', { name: '나중에', exact: true }).click();
  await page
    .getByRole('button', { name: '산책 반응 기록', exact: true })
    .click();
  await choose('좋아했어요').click();
  await page.setViewportSize({ width: 320, height: 360 });
  const largeText = await page.addStyleTag({
    content:
      '[dir="auto"] { font-size: 24px !important; line-height: 36px !important; }',
  });
  for (const name of ['좋아했어요', '보통이에요', '어려워했어요']) {
    const option = choose(name);
    await option.scrollIntoViewIfNeeded();
    const bounds = await option.boundingBox();
    assert(bounds.x >= 0 && bounds.x + bounds.width <= 320);
  }
  await page
    .getByRole('button', { name: '나중에', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: '/tmp/grow-reaction-206/modal-large-text.png',
  });
  await largeText.evaluate((node) => node.remove());
  await page.setViewportSize({ width: 390, height: 844 });
  expired = true;
  await page.evaluate(() => {
    window.expiredReactionSession = true;
  });
  await page
    .getByRole('button', { name: '반응 저장하기', exact: true })
    .click();
  await page.getByRole('textbox', { name: '이메일', exact: true }).waitFor();
  assert.equal(
    await heading.count(),
    0,
    'Session expiration closes private reaction UI',
  );
  await page
    .getByRole('textbox', { name: '이메일', exact: true })
    .fill('second@example.com');
  await page
    .getByRole('textbox', { name: '비밀번호', exact: true })
    .fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByRole('button', { name: '앱 설정', exact: true }).waitFor();
  assert.equal(await heading.count(), 0);
  assert.equal(
    await page.getByRole('button', { name: /산책 반응/ }).count(),
    0,
  );
  console.log(
    'PASS main/todo optional reaction, restore/change/clear, failure/retry, pending, undo, responsive modal',
  );
} finally {
  release?.();
  await browser.close();
}
