import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const base = process.env.MOBILE_URL ?? 'http://localhost:8250';
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
});
page.setDefaultTimeout(30000);
page.setDefaultNavigationTimeout(120000);
await page.addInitScript(authenticatedSessionFixture);
let permissions = 0;
await page.exposeFunction('__permissionRequested', () => {
  permissions++;
});
await page.addInitScript(() => {
  if (window.Notification)
    Notification.requestPermission = () => {
      void window.__permissionRequested();
      return Promise.resolve('denied');
    };
});
let writes = 0;
await page.route('**/api/v1/**', (r) => {
  if (!['GET', 'OPTIONS'].includes(r.request().method())) writes++;
  const path = new URL(r.request().url()).pathname;
  if (path.endsWith('/users/me'))
    return r.fulfill({
      json: { id: 1, name: '보호자', email: 'parent@example.test' },
    });
  if (path.endsWith('/children/me'))
    return r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } });
  if (path.includes('/todos')) return r.fulfill({ json: [] });
  return r.fulfill({ status: 404, json: {} });
});
const click = (name) => page.getByRole('button', { name, exact: true }).click();
const back = () => click('이전 화면으로');
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('/tmp/support-ui-shots', { recursive: true });
try {
  await page.goto(base + '/mypage');
  await page.getByText('parent@example.test', { exact: true }).waitFor();
  for (const name of ['도움말', '문의하기', '알림 설정'])
    assert.equal(
      await page.getByRole('button', { name, exact: true }).count(),
      1,
    );
  await click('도움말');
  await page.waitForURL('**/help');
  const question = page.getByRole('button', {
    name: '아이 정보는 어디서 등록하거나 수정하나요?',
    exact: true,
  });
  assert.equal(await question.getAttribute('aria-expanded'), 'false');
  await question.focus();
  await question.press('Space');
  assert.equal(await question.getAttribute('aria-expanded'), 'true');
  await page
    .getByText(/하단 마이 탭에서 아이 정보 관리를 열어주세요/)
    .waitFor();
  await question.press('Space');
  assert.equal(await question.getAttribute('aria-expanded'), 'false');
  await click('문의하기');
  await page.waitForURL('**/contact');
  await page
    .getByText('문의 접수 기능은 준비 중이에요.', { exact: true })
    .waitFor();
  const title = page.getByRole('textbox', { name: '문의 제목', exact: true });
  const content = page.getByRole('textbox', { name: '문의 내용', exact: true });
  await click('오류 제보');
  assert.equal(
    await page
      .getByRole('button', { name: '오류 제보', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  await title.fill('화면 이용 문의');
  await content.fill('화면 이용 중 불편한 점을 적어요.\n두 번째 줄이에요.');
  assert.match(await content.inputValue(), /\n/);
  assert(
    await page
      .getByRole('button', { name: '문의 보내기', exact: true })
      .isDisabled(),
  );
  await page.setViewportSize({ width: 320, height: 400 });
  await content.focus();
  const send = page.getByRole('button', { name: '문의 보내기', exact: true });
  await send.scrollIntoViewIfNeeded();
  const box = await send.boundingBox();
  assert(
    box.y >= 0 && box.y + box.height <= 400,
    'submit remains reachable in a reduced keyboard viewport',
  );
  await back();
  await page.waitForURL('**/help');
  await click('문의하기');
  assert.equal(await title.inputValue(), '');
  assert.equal(await content.inputValue(), '');
  await back();
  await back();
  await page.waitForURL('**/mypage');
  await click('알림 설정');
  await page.waitForURL('**/notification-settings');
  await page
    .getByRole('switch', { name: '일정 시작 알림', exact: true })
    .waitFor();
  assert.equal(await page.getByRole('switch').count(), 3);
  const toggle = page.getByRole('switch', {
    name: '일정 시작 알림',
    exact: true,
  });
  assert.equal(await toggle.getAttribute('aria-checked'), 'false');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-checked'), 'true');
  await toggle.press('Space');
  assert.equal(await toggle.getAttribute('aria-checked'), 'false');
  await toggle.press('Enter');
  assert.equal(await toggle.getAttribute('aria-checked'), 'true');
  await back();
  await click('알림 설정');
  assert.equal(await toggle.getAttribute('aria-checked'), 'false');
  for (const width of [320, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['help', 'contact', 'notification-settings']) {
      await page.goto(base + '/' + route);
      await page
        .getByRole('heading', {
          name:
            route === 'help'
              ? '도움말'
              : route === 'contact'
                ? '문의하기'
                : '알림 설정',
          exact: true,
        })
        .waitFor();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        'no horizontal overflow',
      );
      for (const control of await page.getByRole('switch').all()) {
        const rect = await control.boundingBox();
        assert(rect.height >= 44 && rect.width >= 44);
      }
      if (width === 390)
        await page.screenshot({
          path: `/tmp/support-ui-shots/${route}.png`,
          fullPage: true,
        });
    }
  }
  assert.equal(writes, 0, 'preview screens never submit or persist remotely');
  assert.equal(permissions, 0, 'no browser notification permission prompt');
  assert.deepEqual(errors, []);
  const guest = await browser.newPage();
  guest.setDefaultNavigationTimeout(120000);
  await guest.goto(base + '/contact');
  await guest.waitForURL('**/login');
  await guest.close();
  console.log(
    'PASS support screens, interactions, responsive layout and signed-out guard',
  );
} finally {
  await browser.close();
}
