import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base = process.env.MOBILE_URL ?? 'http://localhost:8251';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const legacyKey = '@growtogether/diary/preview/v2/2026-11-28';
const legacyValue = JSON.stringify({
  date: '2026-11-28',
  content: 'OLD PRIVATE PREVIEW',
  photoUris: [],
  emotions: [],
  growthPoints: [],
});
try {
  const guest = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  guest.setDefaultNavigationTimeout(120000);
  guest.setDefaultTimeout(30000);
  await guest.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value);
      localStorage.setItem(
        '@growtogether/child/v1/preview',
        JSON.stringify({ name: 'OLD CHILD', birthday: '2024-01-01' }),
      );
    },
    { key: legacyKey, value: legacyValue },
  );
  for (const route of [
    '/main',
    '/calendar',
    '/diary',
    '/children',
    '/mypage',
    '/help',
    '/contact',
    '/notification-settings',
    '/profile',
  ]) {
    console.log('Checking guest route', route);
    await guest.goto(base + route);
    await guest.waitForURL('**/login');
    console.log('Redirected', route);
    assert.equal(
      await guest
        .getByRole('button', { name: '인증 없이 미리보기 진입' })
        .count(),
      0,
    );
  }
  await guest.reload();
  await guest.getByRole('button', { name: '로그인', exact: true }).waitFor();
  assert.equal(
    await guest.evaluate((key) => localStorage.getItem(key), legacyKey),
    legacyValue,
  );
  const user = await browser.newPage({ viewport: { width: 320, height: 740 } });
  user.setDefaultNavigationTimeout(120000);
  user.setDefaultTimeout(30000);
  await user.addInitScript(() => {
    if (!sessionStorage.getItem('fixture-installed')) {
      sessionStorage.setItem('fixture-installed', 'true');
      const tokens = {
        accessToken: `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ iss: 'growtogether-api', sub: '1' }))}.test`,
        refreshToken: 'test-refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
      };
      sessionStorage.setItem('growtogether.auth.v1', JSON.stringify(tokens));
    }
    const fetchOriginal = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (
        new URL(String(input), location.href).pathname ===
        '/api/v1/auth/refresh'
      ) {
        const saved = sessionStorage.getItem('growtogether.auth.v1');
        return Promise.resolve(
          new Response(saved ?? '{}', {
            status: saved ? 200 : 401,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return fetchOriginal(input, init);
    };
  });
  await user.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: legacyKey, value: legacyValue },
  );
  let reads = 0;
  await user.route('**/api/**', (r) => {
    const path = new URL(r.request().url()).pathname;
    reads++;
    if (path.endsWith('/users/me'))
      return r.fulfill({
        json: { id: 1, name: '계정 보호자', email: 'test@example.test' },
      });
    if (path.endsWith('/children/me'))
      return r.fulfill({ json: { name: '서버 아이', birthday: '2024-01-01' } });
    if (path.includes('/diaries'))
      return r.fulfill({
        status: 404,
        json: { code: 'DIARY_NOT_FOUND', message: '없음' },
      });
    return r.fulfill({ json: [] });
  });
  console.log('Checking authenticated main');
  user.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await user.goto(base + '/main');
  await user
    .getByText(/서버 아이/)
    .first()
    .waitFor();
  assert(
    !(await user.locator('body').innerText()).includes('OLD PRIVATE PREVIEW'),
  );
  assert(!(await user.locator('body').innerText()).includes('OLD CHILD'));
  assert(reads > 0);
  assert.equal(
    await user.evaluate((key) => localStorage.getItem(key), legacyKey),
    legacyValue,
  );
  await user.getByRole('tab', { name: '마이', exact: true }).click();
  await user.getByRole('button', { name: '로그아웃', exact: true }).click();
  await user.waitForURL('**/login');
  console.log('Checking authenticated main');
  user.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await user.goto(base + '/main');
  await user.waitForURL('**/login');
  console.log(
    'PASS login-only protected routes, reload, legacy data preservation/isolation, server profile, logout',
  );
} finally {
  await browser.close();
}
