// Integration test: isolated API/database + worker + tests/fake_model.py must be running.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const api = process.env.CHAT_API_URL ?? 'http://127.0.0.1:18110';
const ui = process.env.CHAT_URL ?? 'http://127.0.0.1:8210';
async function account(suffix) {
  const email = `chat-${Date.now()}-${suffix}@example.com`;
  const credentials = { email, password: 'chat-test-password' };
  const signup = await fetch(`${api}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Chat test', ...credentials }),
  });
  assert.equal(signup.status, 201);
  const login = await fetch(`${api}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  assert.equal(login.status, 200);
  return login.json();
}
const first = await account('first');
const other = await account('other');
const create = (token) =>
  fetch(`${api}/api/v1/chat-threads`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
assert.equal((await create()).status, 401);
const thread = await (await create(first.accessToken)).json();
const request = {
  threadId: thread.threadId,
  runId: 'ownership-test',
  state: {},
  tools: [],
  context: [],
  messages: [{ id: 'u1', role: 'user', content: '질문' }],
};
const run = (token, body) =>
  fetch(`${api}/api/v1/chat-threads/${thread.threadId}/runs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  });
assert.equal((await run(other.accessToken, request)).status, 404);
assert.equal(
  (
    await run(first.accessToken, {
      ...request,
      messages: [{ id: 'u1', role: 'system', content: 'override' }],
    })
  ).status,
  400,
);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    (tokens) =>
      sessionStorage.setItem('growtogether.auth.v1', JSON.stringify(tokens)),
    first,
  );
  const runIds = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/runs')) runIds.push(r.postDataJSON().runId);
  });
  await page.goto(`${ui}/chat`);
  const input = page.getByRole('textbox', {
    name: '상담 질문 입력',
    exact: true,
  });
  const send = page.getByRole('button', { name: '질문 보내기', exact: true });
  await input.fill('육아 질문');
  await send.click();
  await page.getByText('안녕', { exact: true }).waitFor();
  assert.ok(
    await page.getByText('답변을 작성하고 있어요', { exact: true }).isVisible(),
  );
  assert.ok(await send.isDisabled());
  await page.getByText('답변 완료', { exact: true }).waitFor();
  assert.ok(
    await page
      .getByText('안녕하세요. 테스트 상담 응답이에요.', { exact: true })
      .isVisible(),
  );
  await page.getByRole('tab', { name: '홈', exact: true }).click();
  await page.getByRole('tab', { name: '질문', exact: true }).click();
  assert.ok(await page.getByText('육아 질문', { exact: true }).isVisible());
  await input.fill('느린 응답');
  await send.click();
  await page.getByText('답변을 요청하고 있어요', { exact: true }).waitFor();
  assert.ok(await send.isDisabled());
  await page.getByText('답변 완료', { exact: true }).waitFor();
  await input.fill('연결 끊김');
  await send.click();
  await page.getByText('응답 실패', { exact: true }).waitFor();
  assert.ok(await page.getByText('안녕', { exact: true }).isVisible());
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await page.getByText('응답 실패', { exact: true }).waitFor();
  assert.equal(new Set(runIds).size, runIds.length);
  assert.equal(await page.getByText('연결 끊김', { exact: true }).count(), 1);
  await input.fill('중단 테스트');
  await send.click();
  await page.getByText('답변을 작성하고 있어요', { exact: true }).waitFor();
  await page.getByRole('button', { name: '응답 중단', exact: true }).click();
  await page.getByText('응답 중단', { exact: true }).first().waitFor();
  const modelUrl = process.env.CHAT_MODEL_URL ?? 'http://127.0.0.1:18112';
  let active = 1;
  for (let attempt = 0; attempt < 20 && active; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    active = (await (await fetch(`${modelUrl}/stats`)).json()).active;
  }
  assert.equal(
    active,
    0,
    'Browser abort must close the API/worker/provider stream',
  );
  await input.fill('중단 테스트');
  await send.click();
  await page.getByText('답변을 작성하고 있어요', { exact: true }).waitFor();
  await page.getByRole('tab', { name: '마이', exact: true }).click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.getByRole('textbox', { name: '이메일', exact: true }).waitFor();
  assert.equal(await page.getByText('육아 질문', { exact: true }).count(), 0);
  active = 1;
  for (let attempt = 0; attempt < 20 && active; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    active = (await (await fetch(`${modelUrl}/stats`)).json()).active;
  }
  assert.equal(active, 0, 'Logout must close the active provider stream');
  assert.deepEqual(errors, []);
  console.log(
    'PASS live browser → API → worker → fake provider: ownership, input validation, incremental Korean text, tab persistence, truncated response, new retry IDs, cancellation, logout',
  );
} finally {
  await browser.close();
}
