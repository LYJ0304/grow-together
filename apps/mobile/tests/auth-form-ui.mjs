import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const base = process.env.MOBILE_URL ?? 'http://localhost:8293';
await mkdir('/tmp/auth-form-polish', { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultNavigationTimeout(120000);
try {
  await page.goto(base + '/signup');
  await page.getByRole('button', { name: '가입하기', exact: true }).waitFor();
  if (process.env.AUTH_FORM_BASELINE)
    await page.screenshot({ path: '/tmp/auth-form-polish/before.png' });
  assert.equal(
    await page.getByText('이름을 입력해 주세요.', { exact: true }).count(),
    0,
  );
  await page.getByRole('button', { name: '가입하기', exact: true }).click();
  await page.getByText('이름을 입력해 주세요.', { exact: true }).waitFor();
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === '이름',
  );
  await page
    .getByRole('heading', { name: '계정 만들기', exact: true })
    .waitFor();
  await page.getByLabel('이름', { exact: true }).fill('보호자');
  await page.getByLabel('이름', { exact: true }).press('Enter');
  assert(
    await page
      .getByLabel('이메일', { exact: true })
      .evaluate((n) => document.activeElement === n),
  );
  await page.getByLabel('이메일', { exact: true }).fill('parent@example.com');
  await page.getByLabel('이메일', { exact: true }).press('Enter');
  await page.getByLabel('비밀번호', { exact: true }).fill('12345678');
  await page.getByLabel('비밀번호', { exact: true }).press('Enter');
  assert(
    await page
      .getByLabel('비밀번호 확인', { exact: true })
      .evaluate((n) => document.activeElement === n),
  );
  await page.getByLabel('비밀번호 확인', { exact: true }).fill('12345678');
  await page
    .getByRole('button', { name: '비밀번호 보기', exact: true })
    .click();
  assert.equal(
    await page.getByLabel('비밀번호', { exact: true }).evaluate((n) => n.type),
    'text',
  );
  assert.equal(
    await page
      .getByLabel('비밀번호 확인', { exact: true })
      .evaluate((n) => n.type),
    'password',
  );
  await page
    .getByRole('button', { name: '비밀번호 확인 보기', exact: true })
    .click();
  assert.equal(
    await page.getByLabel('비밀번호 확인', { exact: true }).inputValue(),
    '12345678',
  );
  for (const [width, height] of [
    [320, 568],
    [375, 667],
    [390, 844],
    [430, 932],
    [1024, 768],
    [390, 400],
  ]) {
    await page.setViewportSize({ width, height });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    for (const label of ['이름', '이메일', '비밀번호', '비밀번호 확인']) {
      const box = await page.getByLabel(label, { exact: true }).boundingBox();
      assert(box.width > 100);
    }
    const button = page.getByRole('button', { name: '가입하기', exact: true });
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    assert(box.height >= 44 && box.x >= 0 && box.x + box.width <= width);
    await page.screenshot({
      path: `/tmp/auth-form-polish/after-${width}-${height}.png`,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/signup');
  for (const [label, value] of [
    ['이름', '보호자'],
    ['이메일', 'parent@example.com'],
    ['비밀번호', '12345678'],
    ['비밀번호 확인', '12345678'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route('**/api/v1/auth/signup', async (route) => {
    requests++;
    const body = route.request().postDataJSON();
    assert.equal(body.password, '12345678');
    await gate;
    await route.fulfill({
      status: 409,
      json: { code: 'EMAIL_ALREADY_EXISTS' },
    });
  });
  await page.getByRole('button', { name: '가입하기', exact: true }).click();
  const pending = page.getByRole('button', { name: '처리 중…', exact: true });
  await pending.waitFor();
  assert(await pending.isDisabled());
  assert(!(await page.getByLabel('이름', { exact: true }).isEditable()));
  await page.getByLabel('비밀번호 확인', { exact: true }).press('Enter');
  release();
  await page.getByText('이미 가입된 이메일이에요.', { exact: true }).waitFor();
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === '이메일',
  );
  assert.equal(requests, 1);
  assert.equal(
    await page
      .getByLabel('이메일', { exact: true })
      .getAttribute('aria-invalid'),
    'true',
  );
  assert.equal(
    await page.getByLabel('비밀번호', { exact: true }).inputValue(),
    '12345678',
  );
  await page.getByRole('link', { name: '로그인', exact: true }).click();
  await page.getByRole('heading', { name: '로그인', exact: true }).waitFor();
  await page.goto(base + '/login?registered=true');
  const success = page.getByText('가입이 완료되었어요. 로그인해 주세요.', {
    exact: true,
  });
  await success.waitFor();
  assert.notEqual(await success.getAttribute('role'), 'alert');
  await page.screenshot({ path: '/tmp/auth-form-polish/login.png' });
  await page.goto(base + '/signup');
  await page
    .getByRole('heading', { name: '계정 만들기', exact: true })
    .waitFor();
  await page.addStyleTag({
    content:
      'input, [dir="auto"] { font-size: 22px !important; line-height: 1.5 !important; }',
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page
    .getByRole('button', { name: '가입하기', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/auth-form-polish/large-text.png' });
  console.log('auth form UI passed');
} finally {
  await browser.close();
}
