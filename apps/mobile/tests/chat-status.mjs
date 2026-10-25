import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await page.addInitScript(authenticatedSessionFixture);
  const requests = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) requests.push(request.url());
  });
  await page.goto(`${process.env.CHAT_URL ?? 'http://127.0.0.1:8204'}/chat`);
  const input = page.getByRole('textbox', {
    name: '상담 질문 입력',
    exact: true,
  });
  await input.waitFor();
  assert.equal(
    await page.getByText('Online', { exact: false }).count(),
    0,
    'No fake online status',
  );
  assert.ok(
    await page.getByText('상담 연결 준비 중', { exact: true }).isVisible(),
  );
  assert.equal(
    await page.getByRole('button', { name: '음성 입력', exact: true }).count(),
    0,
  );
  await input.fill('질문을 작성했습니다');
  await page.getByRole('button', { name: '질문 보내기', exact: true }).click();
  const notice = page.getByRole('alert');
  assert.ok(
    (await notice.innerText()).includes('AI 상담 연결은 아직 준비 중이에요.'),
  );
  assert.equal(await input.inputValue(), '질문을 작성했습니다');
  await page.getByRole('button', { name: '안내 닫기', exact: true }).click();
  assert.equal(await notice.count(), 0);
  assert.ok(await input.evaluate((el) => el === document.activeElement));
  await input.press('Enter');
  assert.ok(
    (await notice.innerText()).includes('AI 상담 연결은 아직 준비 중이에요.'),
  );
  await page.getByRole('button', { name: '안내 닫기', exact: true }).click();
  await page.getByRole('button', { name: '상담 설정', exact: true }).click();
  assert.ok((await notice.innerText()).includes('설정 기능은 준비 중이에요.'));
  await page.getByRole('button', { name: '안내 닫기', exact: true }).click();
  assert.equal(await input.inputValue(), '질문을 작성했습니다');
  assert.ok(await input.evaluate((el) => el === document.activeElement));
  await page.setViewportSize({ width: 320, height: 360 });
  await page.getByRole('button', { name: '질문 보내기', exact: true }).click();
  assert.ok(await notice.isVisible());
  const field = await input.boundingBox();
  const tabs = await page.getByRole('tablist').boundingBox();
  assert.ok(field.y + field.height <= tabs.y);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.equal(
    requests.filter((url) => !url.endsWith('/auth/refresh')).length,
    0,
    'No fake chat/voice API call',
  );
  console.log(
    'PASS: honest readiness, visible accessible send/settings notices, dismiss/focus, preserved draft, no voice button or fake chat requests.',
  );
} finally {
  await browser.close();
}
