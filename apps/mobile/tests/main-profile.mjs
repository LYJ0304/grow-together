import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';

const url = process.env.MAIN_URL ?? 'http://localhost:8098';
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  timezoneId: 'America/New_York',
});
await context.addInitScript(authenticatedSessionFixture);
const page = await context.newPage();
page.setDefaultTimeout(10000);
await page.clock.install({ time: new Date('2026-03-08T00:05:00-05:00') });
let profile = { name: '하늘', birthday: '2026-03-07' };
let profileStatus = 200;
let release;
let pending;
const subjects = [];
await page.route('**/api/v1/children/me', async (route) => {
  const token = route.request().headers().authorization.split('.')[1];
  subjects.push(JSON.parse(Buffer.from(token, 'base64').toString()).sub);
  if (pending) await pending;
  await route.fulfill({
    status: profileStatus,
    json:
      profileStatus === 200
        ? profile
        : {
            code: profileStatus === 404 ? 'CHILD_NOT_FOUND' : 'INTERNAL_ERROR',
          },
  });
});
await page.route('**/api/v1/todos**', (route) => route.fulfill({ json: [] }));
const heading = (name) => page.getByRole('heading', { name, exact: true });
const button = (name) => page.getByRole('button', { name, exact: true });
async function open() {
  await page.goto(`${url}/main`);
  await page.getByTestId('main-screen').waitFor();
}
async function profileTitle(name, days) {
  await heading(`${name}, 함께한 지 +${days}일`).waitFor();
}
try {
  pending = new Promise((resolve) => {
    release = resolve;
  });
  await open();
  await page
    .getByText('아이 정보를 불러오고 있어요.', { exact: true })
    .waitFor();
  release();
  pending = undefined;
  await profileTitle('하늘', 1);
  await page.getByText('2026년 3월 8일 일요일', { exact: true }).waitFor();
  const names = [
    '하늘, 함께한 지 +1일',
    '오늘의 이야기를 남겨보세요',
    '오늘의 루틴',
    '오늘의 일정',
    '기록 돌아보기',
  ];
  const positions = [];
  for (const name of names)
    positions.push((await heading(name).boundingBox()).y);
  assert(
    positions.every((y, i) => i === 0 || y > positions[i - 1]),
    'Home sections follow the planned reading order',
  );
  assert.equal(await page.getByText(/햇살|1.5h|독서 1권|사랑둥이/).count(), 0);
  await button('일기 작성하기').click();
  await page.waitForURL('**/calendar');
  profile = { name: '바다', birthday: '2026-03-08' };
  await page.getByRole('tab', { name: '홈', exact: true }).click();
  await profileTitle('바다', 0);
  // DST starts today: local calendar days must not be truncated to 23-hour days.
  await page.clock.fastForward(23 * 60 * 60 * 1000 + 1);
  await profileTitle('바다', 1);
  await page.getByText('2026년 3월 9일 월요일', { exact: true }).waitFor();
  await page.clock.setSystemTime(new Date('2026-03-10T12:00:00-04:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await profileTitle('바다', 2);
  await button('캘린더에서 돌아보기').click();
  await page.waitForURL('**/calendar');
  await page.getByRole('tab', { name: '홈', exact: true }).click();
  await profileTitle('바다', 2);
  profileStatus = 500;
  await open();
  await page
    .getByText('아이 정보를 불러오지 못했어요.', { exact: true })
    .waitFor();
  assert.equal(await page.getByText('바다', { exact: true }).count(), 0);
  profileStatus = 200;
  await button('아이 정보 다시 시도').click();
  await profileTitle('바다', 2);
  profileStatus = 404;
  await open();
  await page.getByText('아이와 함께하는 첫 기록', { exact: true }).waitFor();
  await button('아이 정보 등록하기').click();
  await page.waitForURL('**/children');
  profileStatus = 200;
  profile = { name: '아주아주긴아이이름'.repeat(4), birthday: '2026-03-08' };
  await open();
  await profileTitle(profile.name, 2);
  for (const width of [320, 375, 393, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 852 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const title = heading(`${profile.name}, 함께한 지 +2일`);
    assert(
      await title.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
    );
  }
  // Switch accounts without reloading so cached profile isolation is exercised.
  await page.route('**/api/v1/auth/logout', (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      json: {
        accessToken: `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ iss: 'growtogether-api', sub: '2' })).toString('base64url')}.ui-test`,
        refreshToken: 'second-account-refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
      },
    }),
  );
  await page.getByRole('tab', { name: '마이', exact: true }).click();
  await button('로그아웃').click();
  profile = { name: '새계정아이', birthday: '2026-03-10' };
  await page
    .getByRole('textbox', { name: '이메일', exact: true })
    .fill('second@example.com');
  await page.getByLabel('비밀번호', { exact: true }).fill('password123');
  await button('로그인').click();
  await profileTitle('새계정아이', 0);
  assert.equal(subjects.at(-1), '2');
  assert.equal(await page.getByText('바다', { exact: true }).count(), 0);
  await page.setViewportSize({ width: 393, height: 852 });
  await page.screenshot({ path: '/tmp/issue-149-main.png' });
  await button('캘린더에서 돌아보기').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/issue-149-main-bottom.png' });
  const preview = await browser.newPage({
    viewport: { width: 320, height: 720 },
  });
  const protectedRequests = [];
  preview.on('request', (request) => {
    if (/\/api\/v1\/(children|todos)/.test(request.url()))
      protectedRequests.push(request.url());
  });
  await preview.addInitScript(() =>
    localStorage.setItem(
      '@growtogether/child/v1/preview',
      JSON.stringify({ name: '미리보기아이', birthday: '2020-01-01' }),
    ),
  );
  await preview.goto(`${url}/login`);
  await preview
    .getByRole('button', { name: '인증 없이 미리보기 진입', exact: true })
    .click();
  await preview
    .getByRole('heading', { name: /^미리보기아이, 함께한 지/ })
    .waitFor();
  await preview
    .getByText('미리보기에서는 서버 일정을 이용할 수 없어요.', { exact: true })
    .waitFor();
  assert.deepEqual(protectedRequests, []);
  assert.equal(await preview.getByRole('progressbar').count(), 0);
  await preview.close();
  console.log(
    'PASS home section order, real profile, loading/404/error/retry, profile edit, birthday/DST/midnight/foreground, account isolation, long names and calendar actions',
  );
} finally {
  await browser.close();
}
