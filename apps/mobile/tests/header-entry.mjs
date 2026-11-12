import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
page.setDefaultTimeout(12000);
await page.addInitScript(authenticatedSessionFixture);
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
const base = process.env.MOBILE_URL ?? 'http://localhost:8156';
await mkdir('/tmp/growtogether-header-entry', { recursive: true });
try {
  await page.goto(`${base}/main`);
  await page
    .getByRole('button', { name: '아이 프로필 열기', exact: true })
    .click();
  await page.waitForURL('**/children');
  await page
    .getByRole('button', { name: '이전 화면으로 돌아가기', exact: true })
    .click();
  await page.waitForURL('**/main');
  await page.getByRole('button', { name: '앱 설정', exact: true }).click();
  await page.waitForURL('**/mypage');
  await page.getByRole('heading', { name: '설정', exact: true }).waitFor();
  assert.equal(
    await page.getByRole('button', { name: '알림 설정', exact: true }).count(),
    0,
  );
  await page.screenshot({
    path: '/tmp/growtogether-header-entry/settings.png',
  });
  for (const route of ['todo', 'calendar', 'chat']) {
    await page.goto(`${base}/${route}`);
    const settings = page.getByRole('button', { name: '앱 설정', exact: true });
    await settings.waitFor();
    const before = await settings.boundingBox();
    await page
      .getByRole('tablist')
      .getByRole('tab', { selected: true })
      .click();
    const scrolled = await page.getByTestId('app-header').evaluate((node) => {
      const container = node.nextElementSibling;
      if (!container) return false;
      const scroller = [container, ...container.querySelectorAll('*')].find(
        (element) =>
          ['auto', 'scroll'].includes(getComputedStyle(element).overflowY) &&
          element.scrollHeight > element.clientHeight,
      );
      if (!scroller) return false;
      scroller.scrollTop = scroller.scrollHeight;
      return scroller.scrollTop > 0;
    });
    if (route === 'chat')
      assert(scrolled, 'Exercise an actual scrolling region');
    const after = await settings.boundingBox();
    assert.equal(
      Math.round(after.y),
      Math.round(before.y),
      'Header remains outside scrolling content',
    );
    assert(before.width >= 44 && before.height >= 44);
    assert.equal(
      await page
        .getByRole('button', { name: '도우미 설정', exact: true })
        .count(),
      0,
    );
  }
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await page.screenshot({ path: '/tmp/growtogether-header-entry/home.png' });
  await page
    .getByRole('button', { name: '오늘 이야기 나누기', exact: true })
    .click();
  await page.waitForURL('**/chat**');
  const input = page.getByRole('textbox', {
    name: '상담 질문 입력',
    exact: true,
  });
  assert(await input.evaluate((node) => node === document.activeElement));
  await page.screenshot({ path: '/tmp/growtogether-header-entry/chat.png' });
  await input.fill('홈에서 이어 쓸 질문 초안');
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await page
    .getByRole('button', { name: '오늘 이야기 나누기', exact: true })
    .click();
  assert.equal(await input.inputValue(), '홈에서 이어 쓸 질문 초안');
  assert.equal(
    await page.getByRole('tablist').getByRole('tab').count(),
    5,
    'Question tab remains during the home-entry trial',
  );
  console.log(
    'PASS independent profile/settings, persistent headers, honest home entry, focused chat and preserved question draft',
  );
} finally {
  await browser.close();
}
