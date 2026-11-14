import { selectDate } from './date-field-fixture.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const base = process.env.MOBILE_URL ?? 'http://localhost:8160';
const empty = {
  prematurityStatus: null,
  expectedDueDate: null,
  concerns: [],
  availableActivityTime: null,
  developmentObservations: [],
};
const make = async (handler) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 760 },
  });
  await context.addInitScript(authenticatedSessionFixture);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.route('**/api/v1/children/me', handler);
  await page.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/v1/auth/logout', (r) => r.fulfill({ status: 204 }));
  return {
    context,
    page,
    click: (name) => page.getByRole('button', { name, exact: true }).click(),
  };
};
const intro = async (page, name = '내 입력') => {
  await page
    .getByRole('textbox', { name: '아이 이름 또는 애칭', exact: true })
    .fill(name);
  await selectDate(page, '생년월일', '2024-03-15');
};
const summary = async (click) => {
  await click('다음');
  await click('건너뛰기');
  await click('건너뛰기');
  await click('건너뛰기');
};
try {
  let failure = true,
    profile = null;
  const legacy = await make((r) => {
    if (r.request().method() === 'GET')
      return r.fulfill(
        failure
          ? { status: 500, json: {} }
          : profile
            ? { json: profile }
            : { status: 404, json: {} },
      );
    const { name, birthday } = r.request().postDataJSON();
    profile = { name, birthday };
    return r.fulfill({ status: 201, json: profile });
  });
  await legacy.page.goto(base + '/main', {
    waitUntil: 'commit',
    timeout: 120000,
  });
  await legacy.page
    .getByRole('alert')
    .filter({ hasText: '아이 정보를 불러오지 못했어요.' })
    .waitFor();
  assert.equal(
    await legacy.page
      .getByRole('heading', { name: '아이를 소개해 주세요' })
      .count(),
    0,
  );
  failure = false;
  await legacy.click('아이 정보 다시 시도');
  await legacy.page
    .getByRole('dialog', { name: '우리 아이를 등록해주세요' })
    .waitFor();
  await legacy.click('아이 정보 등록하기');
  await intro(legacy.page);
  await legacy.page.getByRole('radio', { name: '네', exact: true }).click();
  await selectDate(legacy.page, '출산 예정일', '2024-04-15');
  await legacy.page.getByRole('radio', { name: '네', exact: true }).click();
  assert.equal(
    await legacy.page.getByLabel('출산 예정일', { exact: true }).count(),
    0,
  );

  await summary(legacy.click);
  await legacy.click('같이 키우기 시작하기');
  await legacy.page
    .getByText(
      '기본 정보는 저장됐지만 선택 정보의 저장을 확인하지 못했어요. 입력은 보관하고 있어요.',
      { exact: true },
    )
    .waitFor();
  await legacy.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  assert.equal(await legacy.page.getByRole('tablist').count(), 0);
  await legacy.click('선택 정보는 저장하지 않고 시작');
  await legacy.page
    .getByRole('tablist')
    .waitFor()
    .catch(async (e) => {
      console.error(
        'LEGACY',
        legacy.page.url(),
        await legacy.page.locator('body').innerText(),
      );
      throw e;
    });
  await legacy.context.close();

  let duplicateProfile = null,
    puts = 0;
  const duplicate = await make((r) => {
    if (r.request().method() === 'GET')
      return r.fulfill(
        duplicateProfile
          ? { json: duplicateProfile }
          : { status: 404, json: {} },
      );
    if (r.request().method() === 'PUT') puts++;
    duplicateProfile = {
      name: '먼저 등록된 아이',
      birthday: '2023-01-01',
      personalization: empty,
    };
    return r.fulfill({ status: 409, json: { code: 'CONFLICT' } });
  });
  await duplicate.page.goto(base + '/main', {
    waitUntil: 'commit',
    timeout: 120000,
  });
  await duplicate.click('아이 정보 등록하기');
  await intro(duplicate.page);
  await summary(duplicate.click);
  await duplicate.click('같이 키우기 시작하기');
  await duplicate.click('기존 등록 정보 확인');
  await duplicate.page
    .getByText('등록된 아이: 먼저 등록된 아이', { exact: true })
    .waitFor();
  assert.equal(puts, 0);
  assert(await duplicate.page.getByText('내 입력', { exact: true }).count());
  await duplicate.click('입력 대신 등록된 정보로 계속');
  await duplicate.page.getByRole('tablist').waitFor();
  await duplicate.context.close();

  let editProfile = {
    name: '하늘',
    birthday: '2024-03-15',
    personalization: {
      ...empty,
      concerns: ['sleep'],
      availableActivityTime: '10min',
    },
  };
  const methods = [];
  const edit = await make((r) => {
    const method = r.request().method();
    if (method === 'GET') return r.fulfill({ json: editProfile });
    methods.push(method);
    editProfile = { ...editProfile, ...r.request().postDataJSON() };
    return r.fulfill({ json: editProfile });
  });
  await edit.page.goto(base + '/children', {
    waitUntil: 'commit',
    timeout: 120000,
  });
  await edit.click('개인화 설정 수정');
  assert.equal(
    await edit.page
      .getByRole('textbox', { name: '아이 이름 또는 애칭', exact: true })
      .inputValue(),
    '하늘',
  );
  await edit.click('다음');
  assert.equal(
    await edit.page
      .getByRole('checkbox', { name: '수면', exact: true })
      .getAttribute('aria-checked'),
    'true',
  );
  await edit.click('다음');
  await edit.click('건너뛰기');
  await edit.page.getByRole('radio', { name: '5분 정도', exact: true }).click();
  await edit.click('다음');
  await edit.click('개인화 설정 저장');
  await edit.page
    .getByRole('heading', { name: '아이 프로필', exact: true })
    .waitFor();
  assert.deepEqual(methods, ['PUT']);
  assert.equal(editProfile.personalization.availableActivityTime, '5min');
  await edit.context.close();

  const logout = await make((r) => r.fulfill({ status: 404, json: {} }));
  await logout.page.goto(base + '/main', {
    waitUntil: 'commit',
    timeout: 120000,
  });
  await logout.click('아이 정보 등록하기');
  await intro(logout.page, '秘密の下書き');
  await logout.page.waitForFunction(() =>
    Object.keys(sessionStorage).some((k) =>
      k.startsWith('growtogether.onboarding'),
    ),
  );
  await logout.click('로그아웃');
  await logout.page
    .getByRole('heading', { name: '다시 만났네요!', exact: true })
    .waitFor();
  await logout.page.waitForFunction(
    () =>
      !Object.keys(sessionStorage).some((k) =>
        k.startsWith('growtogether.onboarding'),
      ),
  );
  await logout.context.close();
  console.log(
    'PASS onboarding edges: query failure, legacy partial save, 409 no overwrite, personal settings edit/restore, logout draft deletion',
  );
} finally {
  await browser.close();
}
