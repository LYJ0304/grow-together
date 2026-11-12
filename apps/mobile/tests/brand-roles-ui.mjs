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
  assert.equal((await buttonColors(welcomeLogin)).bg, rgb(colors.tint));
  const signup = await buttonColors(
    page.getByRole('button', { name: '가입하기', exact: true }),
  );
  assert.equal(signup.bg, rgb(colors.buttonRose));
  assert(ratio(signup.bg, signup.fg) >= 4.5);
  await page.screenshot({ path: `${artifacts}/welcome.png` });
  await welcomeLogin.click();
  const login = page.getByRole('button', { name: '로그인', exact: true });
  await login.waitFor();
  let pair = await buttonColors(login);
  assert.equal(
    pair.bg,
    rgb(colors.tint),
    'Auth CTA must use the activity recommendation default fill',
  );
  assert.equal(pair.fg, rgb(colors.onTint));
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
  assert.equal(secondary.bg, rgb(colors.tint));
  assert(ratio(secondary.bg, secondary.fg) >= 4.5);
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
    'Different report actions use distinct tones',
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
  assert.equal((await buttonColors(loginRequired)).bg, rgb(colors.tint));
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
  assert.equal((await buttonColors(writeDiary)).bg, rgb(colors.tint));
  await page.screenshot({ path: `${artifacts}/calendar.png` });
  await writeDiary.click();
  await page
    .getByRole('button', { name: '직접 작성하기', exact: true })
    .waitFor();
  const distinct = async (target, names) => {
    const pairs = [];
    for (const name of names)
      pairs.push(
        await buttonColors(target.getByRole('button', { name, exact: true })),
      );
    assert.equal(
      new Set(pairs.map((p) => p.bg)).size,
      names.length,
      `Distinct actions: ${names.join(', ')}`,
    );
    for (const p of pairs) assert(ratio(p.bg, p.fg) >= 4.5);
  };
  await distinct(page, [
    '기록으로 돌아가기',
    '사진 첨부',
    '입력한 기록으로 초안 정리',
    '직접 작성하기',
  ]);
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
  await distinct(page, [
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
  await page
    .getByRole('textbox', { name: '일기 본문 수정', exact: true })
    .fill('함께한 하루를 기록해요.');
  await page.getByRole('button', { name: '수정 완료', exact: true }).click();
  await page
    .getByRole('button', { name: '이 일기 저장하기', exact: true })
    .waitFor();
  await distinct(page, [
    '기록으로 돌아가기',
    '재료 다시 확인',
    '초안 다시 정리',
  ]);
  await page.screenshot({
    path: `${artifacts}/diary-draft.png`,
    fullPage: true,
  });
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
    rgb(colors.tint),
    'Shared primary CTA must use the peach default',
  );
  assert.equal(sharedPair.fg, rgb(colors.onTint));
  assert(ratio(sharedPair.bg, sharedPair.fg) >= 4.5);
  await register.click();
  await missing.waitForURL('**/onboarding');
  await missing
    .getByRole('textbox', { name: '아이 이름 또는 애칭', exact: true })
    .fill('하늘');
  await missing.getByLabel('생년월일', { exact: true }).fill('2025-01-01');
  await missing.getByRole('button', { name: '다음', exact: true }).click();
  await missing.getByRole('checkbox', { name: '수면', exact: true }).waitFor();
  await distinct(missing, ['이전', '다음', '건너뛰기']);
  await missing.screenshot({
    path: `${artifacts}/onboarding.png`,
    fullPage: true,
  });
  await missing.close();
  console.log(
    'PASS peach default across welcome/auth/recommendation/calendar/report/registration, distinct pink actions, pressed contrast, routing, diary and onboarding tones',
  );
} finally {
  await browser.close();
}
