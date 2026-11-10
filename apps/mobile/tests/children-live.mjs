import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
// Only use an isolated local API/database: this creates a disposable account.
const site = process.env.CHILDREN_URL ?? 'http://localhost:8141';
const api = process.env.CHILDREN_API_URL ?? 'http://localhost:18141';
const email = `child-${Date.now()}@example.com`,
  password = `child-${Date.now()}-password`;
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  assert.equal(
    (
      await context.request.post(api + '/api/v1/auth/signup', {
        data: { name: '온보딩 연동 검증', email, password },
      })
    ).status(),
    201,
  );
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const click = (name) =>
    page.getByRole('button', { name, exact: true }).click();
  const login = async (target) => {
    await target.goto(site + '/login', {
      waitUntil: 'commit',
      timeout: 120000,
    });
    await target
      .getByRole('textbox', { name: '이메일', exact: true })
      .fill(email);
    await target.getByLabel('비밀번호', { exact: true }).fill(password);
    await target.getByRole('button', { name: '로그인', exact: true }).click();
  };
  await login(page);
  await page
    .getByRole('textbox', { name: '아이 이름 또는 애칭', exact: true })
    .fill('  하늘  ');
  await page.getByLabel('생년월일', { exact: true }).fill('2024-02-29');
  await click('다음');
  await page.getByRole('checkbox', { name: '수면', exact: true }).click();
  await click('다음');
  await click('건너뛰기');
  await page.getByRole('radio', { name: '10분 정도', exact: true }).click();
  await click('다음');
  await click('같이 키우기 시작하기');
  await page.getByRole('tablist').waitFor();
  const readServer = async () => {
    const token = await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem('growtogether.auth.v1')).accessToken,
    );
    const response = await context.request.get(api + '/api/v1/children/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status(), 200);
    return response.json();
  };
  let saved = await readServer();
  assert.equal(saved.name, '하늘');
  assert.deepEqual(saved.personalization.concerns, ['sleep']);
  assert.equal(saved.personalization.availableActivityTime, '10min');
  await page.goto(site + '/children');
  await click('개인화 설정 수정');
  assert.equal(
    await page
      .getByRole('textbox', { name: '아이 이름 또는 애칭', exact: true })
      .inputValue(),
    '하늘',
  );
  await click('다음');
  assert.equal(
    await page
      .getByRole('checkbox', { name: '수면', exact: true })
      .getAttribute('aria-checked'),
    'true',
  );
  await click('다음');
  await click('건너뛰기');
  await page.getByRole('radio', { name: '매일 달라요', exact: true }).click();
  await click('다음');
  await click('개인화 설정 저장');
  await page
    .getByRole('heading', { name: '아이 프로필', exact: true })
    .waitFor();
  await click('수정');
  await page
    .getByRole('textbox', { name: '아이 이름', exact: true })
    .fill('바다');
  await click('저장');
  await page.getByText('바다', { exact: true }).waitFor();
  saved = await readServer();
  assert.equal(saved.personalization.availableActivityTime, 'flexible');
  assert.deepEqual(saved.personalization.concerns, ['sleep']);
  await page.goto(site + '/mypage');
  await click('로그아웃');
  await login(page);
  await page.getByRole('tablist').waitFor();
  await page.goto(site + '/children');
  await page.getByText('바다', { exact: true }).waitFor();
  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  await login(second);
  await second.getByRole('tablist').waitFor();
  await second.goto(site + '/children');
  await second.getByText('바다', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('바다', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  await secondContext.close();
  await context.close();
  console.log(
    'PASS live PostgreSQL/API onboarding: signup/login, full create, personalization edit, basic edit preserves choices, logout/login, second client and reload',
  );
} finally {
  await browser.close();
}
