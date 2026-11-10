import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const base = process.env.MOBILE_URL ?? 'http://localhost:8127';
try {
  const context = await browser.newContext({
    viewport: { width: 320, height: 720 },
    reducedMotion: 'reduce',
  });
  await context.addInitScript(authenticatedSessionFixture);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/v1/children/me', (r) =>
    r.fulfill({ json: { name: '하늘', birthday: '2024-01-01' } }),
  );
  let rows = [],
    generation = 0,
    writes = 0,
    genFail = true,
    saveMode = 'lost',
    captured;
  await page.route('**/api/v1/todos**', async (r) => {
    const req = r.request(),
      url = new URL(req.url());
    if (url.pathname.endsWith('/generate')) {
      generation++;
      captured = req.postDataJSON();
      if (genFail)
        return r.fulfill({
          status: 503,
          json: { code: 'SERVICE_UNAVAILABLE' },
        });
      return r.fulfill({
        json: {
          date: captured.date,
          candidates: [
            {
              planName: '책 읽기',
              content: '함께 보기',
              scheduledTime: '09:00:00',
              durationMinutes: 3,
            },
            { planName: '대화', scheduledTime: '09:03:00', durationMinutes: 2 },
          ],
          unscheduled: [{ planName: '배치 못한 활동', durationMinutes: 1 }],
        },
      });
    }
    if (url.pathname.endsWith('/batch')) {
      writes++;
      const body = req.postDataJSON();
      assert.equal(body.date, captured.date);
      if (saveMode === 'conflict')
        return r.fulfill({ status: 409, json: { code: 'CONFLICT' } });
      rows = body.candidates.map((c, i) => ({
        ...c,
        scheduledDate: body.date,
        id: 100 + i,
        completed: false,
      }));
      return r.fulfill(
        saveMode === 'lost'
          ? { status: 500, json: { code: 'INTERNAL_ERROR' } }
          : { status: 201, json: rows },
      );
    }
    return r.fulfill({ json: rows });
  });
  const click = (n) =>
    page.getByRole('button', { name: n, exact: true }).click();
  await page.goto(base + '/todo', { waitUntil: 'commit', timeout: 120000 });
  await click('활동 추천받기');
  await page
    .getByLabel('일정 생성 요청사항', { exact: true })
    .fill('집에서 놀기');
  await click('일정 생성하기');
  await page.getByRole('alert').waitFor();
  assert.equal(
    await page.getByLabel('일정 생성 요청사항', { exact: true }).inputValue(),
    '집에서 놀기',
  );
  genFail = false;
  await click('일정 생성하기');
  await page.getByRole('checkbox', { name: '책 읽기', exact: true }).waitFor();
  assert.equal(writes, 0);
  assert.deepEqual(captured.availableWindows, [
    { start: '09:00:00', end: '18:00:00' },
  ]);
  await page
    .getByLabel('일정 생성 요청사항', { exact: true })
    .fill('집에서 책 보기');
  assert.equal(
    await page
      .getByRole('button', { name: '선택한 일정 확정 저장', exact: true })
      .count(),
    0,
  );
  await click('일정 생성하기');
  await page.getByRole('checkbox', { name: '책 읽기', exact: true }).waitFor();
  assert.equal(captured.instructions, '집에서 책 보기');
  await page.getByRole('checkbox', { name: '대화', exact: true }).click();
  await page.screenshot({ path: '/tmp/issue27-preview.png', fullPage: true });
  await click('선택한 일정 확정 저장');
  await page
    .getByText(
      '저장 여부가 불확실해요. 중복 저장을 막기 위해 목록에서 결과를 먼저 확인해주세요.',
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: '선택한 일정 확정 저장', exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(writes, 1);
  assert.equal(rows.length, 1);
  await click('저장 결과 목록 확인');
  await page
    .getByRole('heading', { name: '현재 서버 일정', exact: true })
    .waitFor();
  await click('닫기');
  await page.getByText('책 읽기', { exact: true }).waitFor();
  await click('활동 추천받기');
  await click('일정 생성하기');
  await page.getByRole('checkbox', { name: '책 읽기', exact: true }).waitFor();
  saveMode = 'conflict';
  await click('선택한 일정 확정 저장');
  await page
    .getByText(
      '최신 일정이나 개인화 설정과 충돌해 저장하지 않았어요. 후보는 유지했어요. 목록을 확인하고 다시 생성해주세요.',
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await page.getByRole('checkbox', { name: '책 읽기', exact: true }).count(),
    1,
  );
  saveMode = 'success';
  await click('선택한 일정 확정 저장');
  await page
    .getByRole('heading', { name: 'AI 일정 미리보기', exact: true })
    .waitFor({ state: 'hidden' });
  assert.equal(writes, 3);
  assert.equal(generation, 4);
  assert.deepEqual(errors, []);
  let held;
  await page.route('**/api/v1/todos/generate', (r) => {
    held = r;
  });
  await click('활동 추천받기');
  await click('일정 생성하기');
  await page
    .getByRole('button', { name: '생성 취소하고 닫기', exact: true })
    .waitFor();
  await click('생성 취소하고 닫기');
  await held
    .fulfill({ json: { date: captured.date, candidates: [], unscheduled: [] } })
    .catch(() => {});
  assert.equal(
    await page
      .getByRole('heading', { name: 'AI 일정 미리보기', exact: true })
      .count(),
    0,
  );
  assert.equal(writes, 3);
  await context.close();
  const previewContext = await browser.newContext({
    viewport: { width: 320, height: 720 },
  });
  const previewPage = await previewContext.newPage();
  let previewApiCalls = 0;
  await previewPage.route('**/api/v1/**', (r) => {
    previewApiCalls++;
    return r.abort();
  });
  await previewPage.goto(base + '/login', {
    waitUntil: 'commit',
    timeout: 120000,
  });
  await previewPage
    .getByRole('button', { name: '인증 없이 미리보기 진입', exact: true })
    .click();
  await previewPage.getByRole('tablist').waitFor();
  await previewPage.getByRole('tab', { name: '일정', exact: true }).click();
  await previewPage
    .getByRole('button', { name: '활동 추천받기', exact: true })
    .click();
  await previewPage
    .getByText('AI 일정 생성은 로그인 후 이용할 수 있어요.', { exact: true })
    .waitFor();
  assert.equal(previewApiCalls, 0);
  await previewContext.close();
  console.log(
    'PASS schedule UI: 320px preview, no write before confirmation, selection, failure preservation, uncertain response inspection, conflict and success',
  );
} finally {
  await browser.close();
}
