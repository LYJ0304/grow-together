import { selectDate } from './date-field-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const colors = vm.runInNewContext(
  readFileSync(
    new URL('../src/theme/colors.ts', import.meta.url),
    'utf8',
  ).replace('export const colors =', 'const colors =') + '\ncolors',
);
const rgb = (hex) =>
  'rgb(' +
  hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16))
    .join(', ') +
  ')';
const luminance = (css) => {
  const c = css
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map((v) => Number(v) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c.reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
};
const ratio = (a, b) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) /
  (Math.min(luminance(a), luminance(b)) + 0.05);
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
});
const base = process.env.MOBILE_URL ?? 'http://localhost:8081';
const artifacts = process.env.BUTTON_ARTIFACTS ?? '/tmp/grow-button-colors';
mkdirSync(artifacts, { recursive: true });
const buttonColors = (button) =>
  button.evaluate((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    fg: getComputedStyle(el.querySelector('[dir="auto"]')).color,
    opacity: getComputedStyle(el).opacity,
  }));
try {
  await page.goto(base + '/welcome', { timeout: 120000 });
  const welcomeLogin = page.getByRole('button', {
    name: '로그인',
    exact: true,
  });
  await welcomeLogin.waitFor();
  assert.equal((await buttonColors(welcomeLogin)).bg, rgb(colors.primary));
  const signup = await buttonColors(
    page.getByRole('button', { name: '가입하기', exact: true }),
  );
  assert.equal(signup.bg, rgb(colors.tint));
  assert(ratio(signup.bg, signup.fg) >= 4.5);
  await page.screenshot({ path: `${artifacts}/welcome.png` });
  await welcomeLogin.click();
  const login = page.getByRole('button', { name: '로그인', exact: true });
  await login.waitFor();
  let pair = await buttonColors(login);
  assert.equal(
    pair.bg,
    rgb(colors.primary),
    'Auth submission is the primary action',
  );
  assert.equal(pair.fg, rgb(colors.surface));
  const preview = await buttonColors(
    page.getByRole('button', { name: '인증 없이 미리보기 진입', exact: true }),
  );
  assert.notEqual(
    preview.bg,
    pair.bg,
    'Login and preview are different actions',
  );
  assert(ratio(preview.bg, preview.fg) >= 4.5);
  assert(ratio(pair.bg, pair.fg) >= 4.5);
  const bounds = await login.boundingBox();
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(100);
  pair = await buttonColors(login);
  assert.equal(pair.opacity, '1', 'Pressed CTA must not fade its text');
  assert(ratio(pair.bg, pair.fg) >= 4.5);
  assert.equal(
    pair.bg,
    rgb(colors.onTint),
    'Pressed primary stays in its color family',
  );
  await page.screenshot({ path: `${artifacts}/primary-pressed.png` });
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await page.screenshot({ path: `${artifacts}/login.png` });
  const home = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await home.addInitScript(authenticatedSessionFixture);
  await home.route('**/api/v1/children/me', (r) =>
    r.fulfill({ json: { name: '하늘', birthday: '2025-01-01' } }),
  );
  await home.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
  await home.goto(base + '/main');
  const make = home.getByRole('button', { name: '일정 만들기', exact: true });
  await make.waitFor();
  const secondary = await buttonColors(make);
  assert.equal(secondary.bg, rgb(colors.primary));
  assert(ratio(secondary.bg, secondary.fg) >= 4.5);
  await make.scrollIntoViewIfNeeded();
  const mainBounds = await make.boundingBox();
  await home.mouse.move(
    mainBounds.x + mainBounds.width / 2,
    mainBounds.y + mainBounds.height / 2,
  );
  await home.mouse.down();
  await home.waitForTimeout(120);
  const motionPressed = await buttonColors(make);
  assert.equal(motionPressed.bg, rgb(colors.onTint));
  assert.equal(motionPressed.opacity, '1');
  assert(ratio(motionPressed.bg, motionPressed.fg) >= 4.5);
  await home.screenshot({ path: `${artifacts}/motion-primary-pressed.png` });
  await home.mouse.move(0, 0);
  await home.mouse.up();
  await home.getByTestId('home-day-heading').scrollIntoViewIfNeeded();
  const active = home.getByRole('tab', { name: '오늘', exact: true });
  await active.locator('img').first().waitFor();
  assert.equal(await active.getAttribute('aria-selected'), 'true');
  const headerIcon = home
    .getByRole('button', { name: '아이 프로필 열기', exact: true })
    .locator('img');
  await headerIcon.waitFor();
  await home.screenshot({ path: `${artifacts}/home.png` });
  await home.setViewportSize({ width: 1280, height: 900 });
  assert(
    await home.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await home.screenshot({ path: `${artifacts}/home-wide.png` });
  await home.setViewportSize({ width: 390, height: 844 });
  await home.getByRole('tab', { name: '리포트', exact: true }).click();
  const reportCTA = home.getByRole('button', {
    name: '일정 확인하기',
    exact: true,
  });
  await reportCTA.waitFor();
  const reportPair = await buttonColors(reportCTA);
  assert(ratio(reportPair.bg, reportPair.fg) >= 4.5);
  const recordsPair = await buttonColors(
    home.getByRole('button', { name: '기록 남기기', exact: true }),
  );
  assert.notEqual(
    recordsPair.bg,
    reportPair.bg,
    'Report prioritizes recording over schedule navigation',
  );
  await home.screenshot({ path: `${artifacts}/report.png` });
  await home.goto(base + '/todo');
  const recommend = home.getByRole('button', {
    name: '활동 추천받기',
    exact: true,
  });
  await recommend.waitFor();
  assert.equal(
    (await buttonColors(recommend)).bg,
    rgb(colors.tint),
    'Reference recommendation remains peach',
  );
  await home.route('**/api/v1/todos/generate', (r) =>
    r.fulfill({
      json: {
        date: r.request().postDataJSON().date,
        candidates: [
          {
            planName: '책 함께 보기',
            content: '그림을 찾아봐요.',
            scheduledTime: '09:00:00',
            durationMinutes: 10,
          },
        ],
        unscheduled: [],
      },
    }),
  );
  await recommend.click();
  const generate = home.getByRole('button', {
    name: '일정 생성하기',
    exact: true,
  });
  await generate.waitFor();
  assert.equal((await buttonColors(generate)).bg, rgb(colors.primary));
  await home.screenshot({ path: `${artifacts}/schedule-input.png` });
  await generate.click();
  const finalSave = home.getByRole('button', {
    name: '선택한 일정 확정 저장',
    exact: true,
  });
  await finalSave.waitFor();
  assert.equal((await buttonColors(finalSave)).bg, rgb(colors.primary));
  assert.equal(
    (
      await buttonColors(
        home.getByRole('button', { name: '다시 생성하기', exact: true }),
      )
    ).bg,
    rgb(colors.tint),
  );
  const candidate = home.getByRole('checkbox', {
    name: '책 함께 보기',
    exact: true,
  });
  assert.equal(await candidate.getAttribute('aria-checked'), 'true');
  assert((await candidate.innerText()).includes('✓'));
  await home.screenshot({ path: `${artifacts}/schedule-selected.png` });
  await candidate.click();
  assert(await finalSave.isDisabled());
  assert.equal(await candidate.getAttribute('aria-checked'), 'false');
  const disabledSave = await buttonColors(finalSave);
  assert.equal(disabledSave.bg, rgb(colors.disabled));
  assert.equal(disabledSave.fg, rgb(colors.muted));
  assert.equal(disabledSave.opacity, '1');
  await home.screenshot({ path: `${artifacts}/schedule-disabled.png` });
  await home.getByRole('button', { name: '닫기', exact: true }).click();
  await home.close();
  await page
    .getByRole('button', { name: '인증 없이 미리보기 진입', exact: true })
    .click();
  await page.getByRole('tab', { name: '리포트', exact: true }).click();
  const loginRequired = page.getByRole('button', {
    name: '로그인하러 가기',
    exact: true,
  });
  await loginRequired.waitFor();
  assert.equal((await buttonColors(loginRequired)).bg, rgb(colors.primary));
  await loginRequired.click();
  await page.getByRole('textbox', { name: '이메일', exact: true }).waitFor();
  await page
    .getByRole('button', { name: '인증 없이 미리보기 진입', exact: true })
    .click();
  await page.getByRole('tab', { name: '기록', exact: true }).click();
  const writeDiary = page.getByRole('button', {
    name: '선택한 날짜의 일기 작성하기',
    exact: true,
  });
  await writeDiary.waitFor();
  await page.waitForFunction(
    () =>
      !document.querySelector('[aria-label="선택한 날짜의 일기 작성하기"]')
        ?.disabled,
  );
  assert.equal((await buttonColors(writeDiary)).bg, rgb(colors.primary));
  await page.screenshot({ path: `${artifacts}/calendar.png` });
  await writeDiary.click();
  await page
    .getByRole('button', { name: '직접 작성하기', exact: true })
    .waitFor();
  const roles = async (target, names) => {
    const primary = ['입력한 기록으로 초안 정리', '이 일기 저장하기', '다음'];
    const tertiary = [
      '기록으로 돌아가기',
      '사진 첨부',
      '첨부 사진 변경',
      '첨부 사진 삭제',
      '재료 다시 확인',
      '이전',
      '건너뛰기',
    ];
    for (const name of names) {
      const pair = await buttonColors(
        target.getByRole('button', { name, exact: true }),
      );
      const foreground = primary.includes(name)
        ? colors.surface
        : tertiary.includes(name)
          ? colors.heading
          : colors.onTint;
      const background = primary.includes(name)
        ? colors.primary
        : tertiary.includes(name)
          ? colors.surface
          : colors.tint;
      assert.equal(pair.bg, rgb(background), name + ' background role');
      assert.equal(pair.fg, rgb(foreground), name + ' foreground role');
      assert.equal(pair.opacity, '1', name + ' must not fade its text');
      assert(ratio(pair.bg, pair.fg) >= 4.5);
    }
    assert(names.filter((name) => primary.includes(name)).length <= 1);
  };
  await roles(page, [
    '기록으로 돌아가기',
    '사진 첨부',
    '입력한 기록으로 초안 정리',
    '직접 작성하기',
  ]);
  await page
    .getByRole('button', { name: '입력한 기록으로 초안 정리', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${artifacts}/diary-materials.png`,
    fullPage: true,
  });
  const upload = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '사진 첨부', exact: true }).click();
  await (
    await upload
  ).setFiles(
    new URL('../assets/images/grow-together-logo.png', import.meta.url)
      .pathname,
  );
  await page
    .getByRole('button', { name: '첨부 사진 삭제', exact: true })
    .waitFor();
  await roles(page, [
    '기록으로 돌아가기',
    '첨부 사진 변경',
    '첨부 사진 삭제',
    '입력한 기록으로 초안 정리',
    '직접 작성하기',
  ]);
  await page
    .getByRole('button', { name: '직접 작성하기', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${artifacts}/diary-with-photo.png` });
  await page
    .getByRole('button', { name: '첨부 사진 삭제', exact: true })
    .click();

  await page
    .getByRole('button', { name: '직접 작성하기', exact: true })
    .click();
  const emptyCompletion = page.getByRole('button', {
    name: '수정 완료',
    exact: true,
  });
  assert(await emptyCompletion.isDisabled());
  const disabledPair = await buttonColors(emptyCompletion);
  assert.equal(disabledPair.opacity, '1');
  assert.equal(disabledPair.bg, rgb(colors.disabled));
  assert.equal(disabledPair.fg, rgb(colors.muted));
  await page.screenshot({ path: `${artifacts}/disabled.png` });
  await page
    .getByRole('textbox', { name: '일기 본문 수정', exact: true })
    .fill('함께한 하루를 기록해요.');
  await page.getByRole('button', { name: '수정 완료', exact: true }).click();
  await page
    .getByRole('button', { name: '이 일기 저장하기', exact: true })
    .waitFor();
  await roles(page, [
    '기록으로 돌아가기',
    '재료 다시 확인',
    '초안 다시 정리',
    '이 일기 저장하기',
  ]);
  await page
    .getByRole('button', { name: '이 일기 저장하기', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${artifacts}/diary-draft.png`,
    fullPage: true,
  });
  await page
    .getByRole('button', { name: '이 일기 저장하기', exact: true })
    .click();
  await page.waitForURL('**/calendar?**');
  await page
    .getByRole('button', { name: '선택한 날짜의 일기 보기', exact: true })
    .click();
  const deletion = page.getByRole('button', { name: '일기 삭제', exact: true });
  await deletion.waitFor();
  const deletePair = await buttonColors(deletion);
  assert.equal(deletePair.bg, rgb(colors.surface));
  assert.equal(deletePair.fg, rgb(colors.danger));
  assert(ratio(deletePair.bg, deletePair.fg) >= 4.5);
  await deletion.click();
  await page
    .getByRole('heading', { name: '일기를 삭제할까요?', exact: true })
    .waitFor();
  const confirm = await buttonColors(
    page.getByRole('button', { name: '삭제', exact: true }),
  );
  assert.equal(confirm.bg, rgb(colors.danger));
  assert.equal(confirm.fg, rgb(colors.surface));
  assert(ratio(confirm.bg, confirm.fg) >= 4.5);
  // Wait for the existing modal fade before recording visual evidence.
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${artifacts}/diary-delete.png` });
  await page.getByRole('button', { name: '취소', exact: true }).click();
  const missing = await browser.newPage({ reducedMotion: 'reduce' });
  await missing.addInitScript(authenticatedSessionFixture);
  await missing.route('**/api/v1/children/me', (r) =>
    r.fulfill({ status: 404, json: { code: 'NOT_FOUND' } }),
  );
  await missing.route('**/api/v1/todos**', (r) => r.fulfill({ json: [] }));
  await missing.goto(base + '/main');
  const register = missing.getByRole('button', {
    name: '아이 정보 등록하기',
    exact: true,
  });
  await register.waitFor();
  const sharedPair = await buttonColors(register);
  assert.equal(
    sharedPair.bg,
    rgb(colors.primary),
    'Registration advances the primary journey',
  );
  assert.equal(sharedPair.fg, rgb(colors.surface));
  assert(ratio(sharedPair.bg, sharedPair.fg) >= 4.5);
  await register.click();
  await missing.waitForURL('**/onboarding');
  await missing
    .getByRole('textbox', { name: '아이 이름 또는 애칭', exact: true })
    .fill('하늘');
  await selectDate(missing, '생년월일', '2025-01-01');
  await missing.getByRole('button', { name: '다음', exact: true }).click();
  await missing.getByRole('checkbox', { name: '수면', exact: true }).waitFor();
  await roles(missing, ['이전', '다음', '건너뛰기']);
  await missing.getByRole('checkbox', { name: '수면', exact: true }).click();
  await missing
    .getByRole('button', { name: '다음', exact: true })
    .scrollIntoViewIfNeeded();
  await missing.screenshot({
    path: `${artifacts}/onboarding.png`,
    fullPage: true,
  });
  await missing.close();
  console.log(
    'PASS semantic action hierarchy, peach recommendation, shared tertiary roles, explicit disabled/pressed contrast, draft save/delete confirmation, routing and onboarding',
  );
} finally {
  await browser.close();
}
