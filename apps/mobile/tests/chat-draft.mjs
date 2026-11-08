import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await page.addInitScript(authenticatedSessionFixture);
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const path = new URL(String(input), location.href).pathname;
      if (path === '/api/v1/auth/logout')
        return Promise.resolve(new Response(null, { status: 204 }));
      if (path === '/api/v1/auth/login')
        return Promise.resolve(
          new Response(
            JSON.stringify({
              accessToken: 'second-user',
              refreshToken: 'second-refresh',
              tokenType: 'Bearer',
              expiresIn: 900,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      return original(input, init);
    };
  });
  const url = process.env.CHAT_URL ?? 'http://127.0.0.1:8203';
  await page.goto(`${url}/chat`);
  const input = page.getByRole('textbox', {
    name: '상담 질문 입력',
    exact: true,
  });
  await input.fill('우리 아이 질문 초안');
  const suggestion = page.getByRole('button', {
    name: '질문 입력: 오늘 집에서 할 놀이를 추천해줘',
    exact: true,
  });
  await suggestion.click();
  assert.equal(
    await input.inputValue(),
    '우리 아이 질문 초안',
    'A suggested question must not overwrite an existing draft',
  );
  const notice = page.getByRole('alert');
  assert.ok(
    (await notice.innerText()).includes(
      '작성 중인 질문을 먼저 마무리해주세요.',
    ),
  );
  assert.ok(
    await input.evaluate((element) => element === document.activeElement),
  );
  await page.getByRole('button', { name: '안내 닫기', exact: true }).click();
  await input.fill('   ');
  await suggestion.click();
  assert.equal(await input.inputValue(), '오늘 집에서 할 놀이를 추천해줘');
  assert.equal(await notice.count(), 0);
  await input.fill('우리 아이 질문 초안');
  const tabs = page.getByRole('tablist');
  for (const [label, route] of [
    ['오늘', '/main'],
    ['기록', '/calendar'],
    ['일정', '/todo'],
  ]) {
    await tabs.getByRole('tab', { name: label, exact: true }).click();
    await page.waitForURL((address) => address.pathname === route);
    await tabs.getByRole('tab', { name: '질문', exact: true }).click();
    assert.equal(
      await input.inputValue(),
      '우리 아이 질문 초안',
      'Tab return preserves draft',
    );
  }
  await page.getByRole('button', { name: '질문 보내기', exact: true }).click();
  assert.equal(
    await input.inputValue(),
    '우리 아이 질문 초안',
    'Unsent draft survives preparation notice',
  );
  await page.getByRole('button', { name: '앱 설정', exact: true }).click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page
    .getByRole('textbox', { name: '이메일', exact: true })
    .fill('second@example.com');
  await page
    .getByRole('textbox', { name: '비밀번호', exact: true })
    .fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  assert.equal(
    await input.inputValue(),
    '',
    'Another account never receives the old draft',
  );
  await input.fill('다른 사용자의 초안');
  await page.getByRole('button', { name: '앱 설정', exact: true }).click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page
    .getByRole('button', { name: '인증 없이 미리보기 진입', exact: true })
    .click();
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  assert.equal(
    await input.inputValue(),
    '',
    'Preview never receives an account draft',
  );
  await input.fill('미리보기 초안');
  await page.getByRole('button', { name: '앱 설정', exact: true }).click();
  await page
    .getByRole('button', { name: '미리보기 종료', exact: true })
    .click();
  await page
    .getByRole('button', { name: '인증 없이 미리보기 진입', exact: true })
    .click();
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  assert.equal(await input.inputValue(), '', 'Ending preview clears its draft');
  await input.fill('새로고침 전 초안');
  await page.reload();
  assert.equal(
    await input.inputValue(),
    '',
    'Drafts are not persisted across reload',
  );
  console.log(
    'PASS: all tab round trips, unsent text, logout/login, account/preview separation, preview exit and memory-only lifetime.',
  );
} finally {
  await browser.close();
}
