import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';

const url = process.argv[2] ?? 'http://localhost:8170';
const phase = process.env.TODO_PHASE ?? 'all';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 320, height: 568 },
  timezoneId: 'Asia/Seoul',
});
await context.addInitScript(authenticatedSessionFixture);
const page = await context.newPage();
await page.clock.setFixedTime(new Date('2026-10-31T00:30:00+09:00'));
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(120000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const records = [
  {
    id: 42,
    planName: '서버 아침',
    content: null,
    scheduledDate: '2026-10-31',
    scheduledTime: '08:00:00',
  },
  {
    id: 43,
    planName: '서버 산책',
    content: '유모차',
    scheduledDate: '2026-10-31',
    scheduledTime: '10:00:00',
  },
];
let nextId = 44;
let reads = 0;
let writes = 0;
let readFailure = false;
let writeFailure = false;
let loseResponse = false;
let delayedRead;
let releaseWrite;
const requests = [];
await page.route('**/api/v1/auth/login', (route) =>
  route.fulfill({
    json: {
      accessToken: 'ui-test-access-b',
      refreshToken: 'ui-test-refresh-b',
      tokenType: 'Bearer',
      expiresIn: 900,
    },
  }),
);
await page.route('**/api/v1/auth/logout', (route) =>
  route.fulfill({ status: 204 }),
);
await page.route('**/api/v1/todos**', async (route) => {
  const request = route.request();
  const target = new URL(request.url());
  const method = request.method();
  const token = request.headers().authorization;
  assert.ok(
    ['Bearer ui-test-access', 'Bearer ui-test-access-b'].includes(token),
  );
  if (method === 'GET') {
    reads++;
    if (delayedRead) {
      const wait = delayedRead;
      delayedRead = undefined;
      await wait;
    }
    if (readFailure)
      return route.fulfill({ status: 500, json: { code: 'HTTP_ERROR' } });
    return route.fulfill({
      json:
        token === 'Bearer ui-test-access-b'
          ? [
              {
                id: 101,
                planName: '두번째 계정 일정',
                content: '',
                scheduledDate: '2026-10-31',
                scheduledTime: '12:00:00',
              },
            ]
          : records.filter(
              (todo) => todo.scheduledDate === target.searchParams.get('date'),
            ),
    });
  }
  writes++;
  const input = request.postDataJSON();
  requests.push({ method, path: target.pathname, input });
  if (releaseWrite) await releaseWrite;
  if (writeFailure)
    return route.fulfill({ status: 400, json: { code: 'INVALID_REQUEST' } });
  const id = Number(target.pathname.split('/').at(-1));
  if (method === 'POST') records.push({ id: nextId++, ...input });
  if (method === 'PUT')
    Object.assign(
      records.find((todo) => todo.id === id),
      input,
    );
  if (method === 'DELETE')
    records.splice(
      records.findIndex((todo) => todo.id === id),
      1,
    );
  if (loseResponse) return route.abort('connectionfailed');
  return method === 'DELETE'
    ? route.fulfill({ status: 204 })
    : route.fulfill({
        status: method === 'POST' ? 201 : 200,
        json:
          method === 'POST'
            ? { message: 'Todo created Successful' }
            : records.find((todo) => todo.id === id),
      });
});
const button = (name) => page.getByRole('button', { name, exact: true });
const text = (value) => page.getByText(value, { exact: true });
async function openForm() {
  await button('＋ 계획 추가').click();
  await page.getByRole('textbox', { name: '계획명', exact: true }).waitFor();
}
async function fill(name, time = '09:30', memo = '준비물') {
  await page.getByRole('textbox', { name: '계획명', exact: true }).fill(name);
  await page
    .getByRole('textbox', { name: '계획 시간', exact: true })
    .fill(time);
  await page
    .getByRole('textbox', { name: '계획 메모', exact: true })
    .fill(memo);
}
try {
  await page.goto(`${url}/todo`);
  await text('서버 아침').waitFor();
  await text('서버 산책').waitFor();
  assert.equal(await text('기상 & 기저귀 갈기').count(), 0);
  assert.equal(await page.getByText('# 발달 자극', { exact: true }).count(), 0);
  await button('10월 30일 금요일').click();
  await text('등록된 일정이 없어요.').waitFor();
  assert.equal(await text('서버 아침').count(), 0);
  await button('10월 31일 토요일').click();
  await text('서버 아침').waitFor();
  if (phase === 'read') {
    console.log(
      'PASS server list, date selection, empty list, nullable content',
    );
  } else {
    await openForm();
    await button('추가하기').click();
    await text('계획명을 입력해 주세요.').waitFor();
    for (const invalid of ['24:00', '12:60', '9:30']) {
      await fill('공원 산책', invalid);
      await button('추가하기').click();
      await page
        .getByText('시간을 09:30처럼 입력해 주세요.', { exact: false })
        .waitFor();
    }
    assert.equal(
      await page
        .getByRole('textbox', { name: '계획 메모', exact: true })
        .getAttribute('maxlength'),
      '255',
    );
    await fill('  공원 산책  ');
    writeFailure = true;
    const beforeFailure = writes;
    await button('추가하기').click();
    await text('입력 내용을 확인해 주세요.').waitFor();
    assert.equal(
      await page
        .getByRole('textbox', { name: '계획명', exact: true })
        .inputValue(),
      '  공원 산책  ',
    );
    assert.equal(writes, beforeFailure + 1);
    writeFailure = false;
    let finish;
    releaseWrite = new Promise((resolve) => {
      finish = resolve;
    });
    const beforeSave = writes;
    await button('추가하기').click();
    await button('저장 중…').waitFor();
    assert.equal(
      await button('저장 중…').getAttribute('aria-disabled'),
      'true',
    );
    finish();
    releaseWrite = undefined;
    await page
      .getByRole('textbox', { name: '계획명', exact: true })
      .waitFor({ state: 'hidden' });
    await text('공원 산책').waitFor();
    assert.equal(writes, beforeSave + 1);
    assert.deepEqual(requests.at(-1).input, {
      planName: '공원 산책',
      content: '준비물',
      scheduledDate: '2026-10-31',
      scheduledTime: '09:30:00',
    });
    const labels = await page
      .getByRole('button')
      .evaluateAll((nodes) =>
        nodes
          .map((node) => node.getAttribute('aria-label'))
          .filter((label) => /^\d{2}:\d{2} /.test(label ?? '')),
      );
    assert.deepEqual(labels, [
      '08:00 서버 아침',
      '09:30 공원 산책',
      '10:00 서버 산책',
    ]);
    if (phase === 'save') {
      console.log(
        'PASS async save, validation, field mapping, local date, input retention, duplicate prevention',
      );
    } else {
      await openForm();
      await fill('같은 시간 일정');
      await button('추가하기').click();
      await page
        .getByRole('textbox', { name: '계획명', exact: true })
        .waitFor({ state: 'hidden' });
      await text('같은 시간 일정').waitFor();
      await button('공원 산책 메뉴').click();
      await button('수정').click();
      assert.equal(
        await page
          .getByRole('textbox', { name: '계획명', exact: true })
          .inputValue(),
        '공원 산책',
      );
      await fill('수정한 산책', '11:00', '수정 메모');
      await button('수정하기').click();
      await page
        .getByRole('textbox', { name: '계획명', exact: true })
        .waitFor({ state: 'hidden' });
      await text('수정한 산책').waitFor();
      assert.equal(requests.at(-1).path, '/api/v1/todos/44');
      assert.equal(requests.at(-1).method, 'PUT');
      await button('수정한 산책 메뉴').click();
      await button('삭제').click();
      await button('취소').click();
      await text('수정한 산책').waitFor();
      await button('수정한 산책 메뉴').click();
      await button('삭제').click();
      writeFailure = true;
      await button('삭제하기').click();
      await text('입력 내용을 확인해 주세요.').waitFor();
      assert.ok(records.some((todo) => todo.id === 44));
      writeFailure = false;
      await button('삭제하기').click();
      await button('삭제하기').waitFor({ state: 'hidden' });
      await text('수정한 산책').waitFor({ state: 'hidden' });
      assert.equal(requests.at(-1).path, '/api/v1/todos/44');
      assert.equal(requests.at(-1).method, 'DELETE');
      // A saved request with a lost response must not silently submit again.
      await openForm();
      await fill('응답 유실 일정');
      loseResponse = true;
      const beforeLost = writes;
      await button('추가하기').click();
      await page
        .getByText('저장 여부를 확인하지 못했어요.', { exact: false })
        .waitFor();
      assert.equal(writes, beforeLost + 1);
      assert.equal(
        await page
          .getByRole('textbox', { name: '계획명', exact: true })
          .inputValue(),
        '응답 유실 일정',
      );
      loseResponse = false;
      await button('취소').click();
      await button('목록 새로고침').click();
      await text('응답 유실 일정').waitFor();
      await text('같은 시간 일정').waitFor();
      // Reload reads server data; a delayed response cannot replace another date.
      await page.reload();
      await text('서버 아침').waitFor();
      let release;
      delayedRead = new Promise((resolve) => {
        release = resolve;
      });
      await button('목록 새로고침').click();
      await button('10월 30일 금요일').click();
      await text('등록된 일정이 없어요.').waitFor();
      release();
      assert.equal(await text('서버 아침').count(), 0);
      readFailure = true;
      await button('목록 새로고침').click();
      await text('일정을 불러오지 못했어요.').waitFor();
      readFailure = false;
      await button('다시 시도').click();
      await text('일정을 불러오지 못했어요.').waitFor({ state: 'hidden' });
      await text('등록된 일정이 없어요.').waitFor();
      const layout = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
      }));
      assert.ok(layout.width <= layout.viewport);
      await button('10월 31일 토요일').click();
      await text('서버 아침').waitFor();
      let finishOldAccount;
      delayedRead = new Promise((resolve) => {
        finishOldAccount = resolve;
      });
      const oldRequest = page.waitForRequest((request) =>
        request.url().includes('/api/v1/todos?'),
      );
      await button('목록 새로고침').click();
      await oldRequest;
      const beforeLogout = reads;
      await page.getByRole('tab', { name: '마이', exact: true }).click();
      await button('로그아웃').click();
      await page
        .getByRole('heading', { name: '다시 만났네요!', exact: true })
        .waitFor();
      await button('인증 없이 미리보기 진입').click();
      await page.getByRole('tab', { name: '투두', exact: true }).click();
      await text('미리보기에서는 서버 일정을 이용할 수 없어요.').waitFor();
      assert.equal(await text('서버 아침').count(), 0);
      finishOldAccount();
      assert.equal(reads, beforeLogout);
      assert.equal(
        await button('＋ 계획 추가').getAttribute('aria-disabled'),
        'true',
      );
      await page.getByRole('tab', { name: '마이', exact: true }).click();
      await button('미리보기 종료').click();
      await page
        .getByRole('textbox', { name: '이메일', exact: true })
        .fill('second@example.com');
      await page.getByLabel('비밀번호', { exact: true }).fill('password123');
      await button('로그인').click();
      await page.getByRole('tab', { name: '투두', exact: true }).click();
      await text('두번째 계정 일정').waitFor();
      assert.equal(await text('서버 아침').count(), 0);
      assert.equal(await text('응답 유실 일정').count(), 0);
      await page.screenshot({
        path: '/tmp/grow-together-70-todo.png',
        fullPage: true,
      });
      await openForm();
      await fill('취소한 계획');
      await button('취소').click();
      await openForm();
      assert.equal(
        await page
          .getByRole('textbox', { name: '계획명', exact: true })
          .inputValue(),
        '',
      );
      const modalLayout = await button('추가하기').boundingBox();
      assert.ok(modalLayout.y + modalLayout.height <= 568);
      await button('취소').click();
      assert.deepEqual(errors, []);
      console.log(
        'PASS todo UI CRUD, errors, lost responses, date isolation, reload, logout/preview, narrow viewport',
      );
    }
  }
} finally {
  await browser.close();
}
