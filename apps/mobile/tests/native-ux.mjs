import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const phase = process.env.UX_PHASE ?? 'home';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 320, height: 700 },
  timezoneId: 'Asia/Seoul',
  reducedMotion: 'reduce',
});
page.setDefaultTimeout(10000);
await page.addInitScript(authenticatedSessionFixture);
await page.clock.setFixedTime(new Date('2026-11-09T12:00:00+09:00'));
const records = [
  {
    id: 5,
    planName: '완료한 활동',
    scheduledTime: '07:00:00',
    completed: true,
  },
  { id: 3, planName: '동시간 뒤', scheduledTime: '10:00:00', completed: false },
  { id: 2, planName: '동시간 앞', scheduledTime: '10:00:00', completed: false },
  {
    id: 1,
    planName: '먼저 할 활동',
    scheduledTime: '09:00:00',
    completed: false,
  },
  { id: 4, planName: '늦은 활동', scheduledTime: '18:00:00', completed: false },
].map((r) => ({ ...r, scheduledDate: '2026-11-09' }));
let failure = false,
  empty = false,
  writes = 0,
  hold,
  release;
await page.route('**/api/v1/children/me', (r) =>
  r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
);
await page.route('**/api/v1/todos**', async (r) => {
  if (r.request().method() === 'PUT') {
    writes++;
    if (hold) await hold;
    if (failure) return r.fulfill({ status: 500, json: {} });
    const todo = records.find(
      (t) =>
        t.id === Number(new URL(r.request().url()).pathname.split('/').at(-2)),
    );
    todo.completed = r.request().postDataJSON().completed;
    return r.fulfill({ json: todo });
  }
  return r.fulfill({ json: empty ? [] : records });
});
const button = (name) => page.getByRole('button', { name, exact: true });
const tab = (name) => page.getByRole('tab', { name, exact: true });
const input = (name) => page.getByRole('textbox', { name, exact: true });
try {
  await page.goto(`${process.env.MOBILE_URL ?? 'http://localhost:8158'}/main`);
  await mkdir('/tmp/growtogether-158', { recursive: true });
  if (process.env.UX_BEFORE)
    await page.screenshot({ path: '/tmp/growtogether-158/before.png' });
  if (phase === 'home') {
    await page
      .getByRole('heading', { name: '무엇이 궁금하세요?', exact: true })
      .waitFor();
    await input('홈 질문 입력').fill('지금 작성하는 질문');
    await button('놀이 추천').click();
    assert.equal(
      await input('홈 질문 입력').inputValue(),
      '지금 작성하는 질문',
    );
    await button('질문 이어서 보내기').click();
    await page.waitForURL('**/chat**');
    assert.equal(
      await input('상담 질문 입력').inputValue(),
      '지금 작성하는 질문',
    );
    assert(
      await input('상담 질문 입력').evaluate(
        (el) => el === document.activeElement,
      ),
    );
    await tab('오늘').click();
    const rows = page
      .getByTestId('home-schedule-row')
      .filter({ visible: true });
    assert.deepEqual(
      await rows
        .locator('[role="checkbox"]')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label'))),
      ['먼저 할 활동 완료', '동시간 앞 완료', '동시간 뒤 완료'],
    );
    await page.screenshot({ path: '/tmp/growtogether-158/after.png' });
    const progress = page.getByRole('progressbar', {
      name: '오늘 일정 완료율',
    });
    assert.equal(await progress.getAttribute('aria-valuenow'), '20');
    hold = new Promise((r) => {
      release = r;
    });
    await page
      .getByRole('checkbox', { name: '먼저 할 활동 완료', exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[role="checkbox"]')
          ?.getAttribute('aria-disabled') === 'true',
    );
    assert.equal(await progress.getAttribute('aria-valuenow'), '20');
    release();
    hold = undefined;
    await page.waitForFunction(
      () =>
        document
          .querySelector('[role="progressbar"]')
          ?.getAttribute('aria-valuenow') === '40',
    );
    assert.equal(writes, 1);
    failure = true;
    await page
      .getByRole('checkbox', { name: '동시간 앞 완료', exact: true })
      .click();
    await page
      .getByRole('alert')
      .filter({ hasText: '완료 상태를 저장하지 못했어요' })
      .waitFor();
    assert.equal(await progress.getAttribute('aria-valuenow'), '40');
    failure = false;
    await button('일정 다시 불러오기').click();
    await tab('일정').click();
    await page
      .getByRole('checkbox', { name: '먼저 할 활동 완료 취소', exact: true })
      .waitFor();
    await tab('오늘').click();
    records.forEach((r) => {
      r.completed = true;
    });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page
      .getByText('오늘 일정을 모두 마쳤어요.', { exact: true })
      .waitFor();
    assert.equal(await button('일정 만들기').count(), 0);
    empty = true;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await button('일정 만들기').click();
    await input('계획명').waitFor();
    await button('취소').click();
    await tab('오늘').click();
    await page.screenshot({ path: '/tmp/growtogether-158/empty.png' });
  } else if (phase === 'navigation') {
    await tab('일정').click();
    await page.getByRole('tab', { name: '할 일', exact: true }).click();
    await tab('질문').click();
    await input('상담 질문 입력').fill('탭에서 보존할 질문');
    await tab('일정').click();
    assert.equal(
      await page
        .getByRole('tab', { name: '할 일', exact: true })
        .getAttribute('aria-selected'),
      'true',
      'Tabs preserve screen-local view mode without remounting',
    );
    await tab('질문').click();
    assert.equal(
      await input('상담 질문 입력').inputValue(),
      '탭에서 보존할 질문',
    );
    await tab('오늘').click();
    await page.setViewportSize({ width: 320, height: 420 });
    const scrollOffset = async (move = false) =>
      input('홈 질문 입력').evaluate((node, move) => {
        let parent = node.parentElement;
        while (
          parent &&
          !(
            ['auto', 'scroll'].includes(getComputedStyle(parent).overflowY) &&
            parent.scrollHeight > parent.clientHeight
          )
        )
          parent = parent.parentElement;
        if (!parent) return 0;
        if (move) parent.scrollTop = parent.scrollHeight;
        return parent.scrollTop;
      }, move);
    assert((await scrollOffset(true)) > 0);
    await tab('질문').click();
    await tab('오늘').click();
    assert((await scrollOffset()) > 0, 'Tab return retains scroll position');
    await tab('오늘').click();
    await page.waitForTimeout(100);
    assert.equal(
      await scrollOffset(),
      0,
      'Reselect scrolls to top, including Reduce Motion',
    );
    await button('앱 설정').click();
    await button('이전 화면으로').click();
    await page.waitForURL('**/main');
    assert.equal(await page.getByRole('tablist').count(), 1);
    await page.goBack();
    await page.goForward();
    assert.equal(await page.getByRole('tablist').count(), 1);
  } else if (phase === 'session') {
    await page.route('**/api/v1/auth/logout', (r) =>
      r.fulfill({ status: 204 }),
    );
    hold = new Promise((resolve) => {
      release = resolve;
    });
    await page
      .getByRole('checkbox', { name: '먼저 할 활동 완료', exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[role="checkbox"]')
          ?.getAttribute('aria-disabled') === 'true',
    );
    await button('앱 설정').click();
    await button('로그아웃').click();
    await button('인증 없이 미리보기 진입').click();
    await page.waitForURL('**/main');
    release();
    hold = undefined;
    await page.waitForTimeout(100);
    assert.equal(await page.getByRole('progressbar').count(), 0);
    assert.equal(
      await page.getByTestId('home-schedule-row').count(),
      0,
      'An old completion response cannot repopulate preview',
    );
  } else {
    await tab('일정').click();
    await button('＋ 직접 추가').click();
    await input('계획명').fill('보존해야 할 입력');
    await button('취소').click();
    await page
      .getByText('작성 중인 내용을 버릴까요?', { exact: true })
      .waitFor();
    await button('계속 작성').click();
    assert.equal(await input('계획명').inputValue(), '보존해야 할 입력');
    await button('계획 추가 닫기').click();
    await button('내용 버리기').click();
    await button('＋ 직접 추가').click();
    assert.equal(await input('계획명').inputValue(), '');
    await button('취소').click();
  }
  console.log(`PASS native UX ${phase}`);
} finally {
  await browser.close();
}
