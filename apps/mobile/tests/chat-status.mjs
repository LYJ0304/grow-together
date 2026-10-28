import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { authenticatedSessionFixture } from './auth-fixture.mjs';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await page.addInitScript(authenticatedSessionFixture);
  await page.route('**/api/v1/chat-threads', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"code":"SERVICE_UNAVAILABLE"}',
    }),
  );
  await page.goto(`${process.env.CHAT_URL ?? 'http://127.0.0.1:8210'}/chat`);
  const input = page.getByRole('textbox', {
    name: '상담 질문 입력',
    exact: true,
  });
  await input.waitFor();
  assert.ok(
    await page.getByText('상담을 시작해보세요', { exact: true }).isVisible(),
  );
  assert.equal(await page.getByText('Online', { exact: false }).count(), 0);
  assert.equal(
    await page.getByRole('button', { name: '음성 입력', exact: true }).count(),
    0,
  );
  await input.fill('질문을 작성했습니다');
  await page.getByRole('button', { name: '질문 보내기', exact: true }).click();
  await page.getByText('응답 실패', { exact: true }).waitFor();
  assert.ok(
    await page.getByText('질문을 작성했습니다', { exact: true }).isVisible(),
  );
  assert.ok(
    await page
      .getByRole('button', { name: '다시 시도', exact: true })
      .isVisible(),
  );
  await page.getByRole('button', { name: '상담 설정', exact: true }).click();
  const notice = page
    .getByRole('alert')
    .filter({ hasText: '설정 기능은 준비 중이에요.' });
  await notice.waitFor();
  await page.getByRole('button', { name: '안내 닫기', exact: true }).click();
  assert.equal(await notice.count(), 0);
  assert.ok(await input.evaluate((el) => el === document.activeElement));
  await page.setViewportSize({ width: 320, height: 360 });
  const field = await input.boundingBox();
  const tabs = await page.getByRole('tablist').boundingBox();
  assert.ok(field.y + field.height <= tabs.y);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  console.log(
    'PASS truthful idle/error states, retained question/retry, accessible settings, focus and short layout',
  );
} finally {
  await browser.close();
}
