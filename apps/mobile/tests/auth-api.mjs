import assert from 'node:assert/strict';
import { loadAuthModule } from './auth-loader.mjs';

// Use an isolated test API with JWT_ACCESS_TOKEN_SECONDS=5; creates disposable data.
const apiUrl = process.argv[2] ?? 'http://localhost:18069';
let refreshes = 0;
const { AuthSession } = loadAuthModule({
  process: { env: { EXPO_PUBLIC_API_URL: apiUrl } },
  fetch: (url, init) => {
    if (url.endsWith('/refresh')) refreshes++;
    return fetch(url, init);
  },
});
let saved = null;
const storage = {
  read: async () => saved,
  write: async (v) => {
    saved = v;
  },
  clear: async () => {
    saved = null;
  },
};
const client = new AuthSession(storage, () => {});
const credentials = {
  email: `api-auth-${Date.now()}@example.com`,
  password: 'auth-test-password',
};
await client.signup({ name: '인증 API 테스트', ...credentials });
await client.login(credentials);
const oldAccess = JSON.parse(saved).accessToken;
await client.request('/api/v1/todos', {
  method: 'POST',
  body: JSON.stringify({
    planName: '인증 연동 확인',
    scheduledDate: '2026-10-18',
    scheduledTime: '09:00:00',
    content: '격리된 테스트 데이터',
  }),
});
assert.equal((await client.request('/api/v1/todos?date=2026-10-18')).length, 1);
await new Promise((resolve) => setTimeout(resolve, 6000));
await Promise.all([
  client.request('/api/v1/todos?date=2026-10-18'),
  client.request('/api/v1/todos?date=2026-10-18'),
]);
assert.equal(refreshes, 1);
assert.notEqual(JSON.parse(saved).accessToken, oldAccess);
const restored = new AuthSession(storage, () => {});
await restored.restore();
assert.equal(restored.getSnapshot().status, 'authenticated');
assert.equal(refreshes, 2);
const access = JSON.parse(saved).accessToken;
await restored.logout();
assert.equal(saved, null);
const response = await fetch(`${apiUrl}/api/v1/todos?date=2026-10-18`, {
  headers: { Authorization: `Bearer ${access}` },
});
assert.equal(response.status, 401);
console.log(
  'Live auth API checks passed (signup, protected CRUD, expiry/concurrent refresh, restore, immediate server revocation)',
);
