import assert from 'node:assert/strict';
import { loadAuthModule } from './auth-loader.mjs';

const requests = [];
let refreshes = 0;
let status = 200;
let unavailable = false;
let release;
let delay = false;
const profile = { name: '하늘', birthday: '2024-02-29' };
const json = (value, code = 200) =>
  new Response(JSON.stringify(value), { status: code });
const tokens = (id) => ({
  accessToken: `access-${id}`,
  refreshToken: `refresh-${id}`,
  tokenType: 'Bearer',
  expiresIn: 900,
});
const [{ AuthSession }, { createChildApi }] = loadAuthModule(
  {
    process: { env: { EXPO_PUBLIC_API_URL: 'http://localhost:18069' } },
    fetch: async (url, init) => {
      if (url.endsWith('/login')) return json(tokens(1));
      if (url.endsWith('/refresh')) {
        refreshes++;
        return json(tokens(2));
      }
      if (url.endsWith('/logout')) return new Response(null, { status: 204 });
      const token = init.headers.get('Authorization');
      assert.ok(token?.startsWith('Bearer access-'));
      if (token === 'Bearer access-1')
        return json({ code: 'UNAUTHORIZED' }, 401);
      requests.push({
        path: new URL(url).pathname,
        method: init.method,
        body: init.body,
      });
      if (init.body)
        assert.equal(init.headers.get('Content-Type'), 'application/json');
      if (unavailable) throw new Error('offline');
      if (delay)
        await new Promise((resolve) => {
          release = resolve;
        });
      return status >= 400
        ? json({ code: 'HTTP_ERROR' }, status)
        : json(profile, init.method === 'POST' ? 201 : 200);
    },
  },
  [
    '../src/lib/features/auth/index.ts',
    '../src/lib/features/child/childApi.ts',
  ],
);
const session = new AuthSession(
  { read: async () => null, write: async () => {}, clear: async () => {} },
  () => {},
);
const api = createChildApi(session);
await assert.rejects(api.getProfile(), (error) => error.status === 401);
await session.login({ email: 'user@example.com', password: 'password123' });
assert.deepEqual(await api.getProfile(), profile);
assert.deepEqual(await api.createProfile(profile), profile);
assert.deepEqual(await api.saveProfile(profile), profile);
assert.equal(refreshes, 1);
assert.deepEqual(requests, [
  { path: '/api/v1/children/me', method: 'GET', body: undefined },
  {
    path: '/api/v1/children/me',
    method: 'POST',
    body: JSON.stringify(profile),
  },
  { path: '/api/v1/children/me', method: 'PUT', body: JSON.stringify(profile) },
]);
status = 404;
assert.equal(await api.getProfile(), null);
await assert.rejects(api.saveProfile(profile), (error) => error.status === 404);
status = 409;
await assert.rejects(
  api.createProfile(profile),
  (error) => error.status === 409,
);
assert.equal(requests.at(-1).method, 'POST');
for (status of [400, 403, 500]) {
  await assert.rejects(api.getProfile(), (error) => error.status === status);
  await assert.rejects(
    api.saveProfile(profile),
    (error) => error.status === status,
  );
}
unavailable = true;
await assert.rejects(
  api.getProfile(),
  (error) => error.code === 'NETWORK_ERROR',
);
unavailable = false;
status = 200;
for (const operation of [
  () => api.getProfile(),
  () => api.createProfile(profile),
  () => api.saveProfile(profile),
]) {
  delay = false;
  await session.login({ email: 'user@example.com', password: 'password123' });
  delay = true;
  const late = operation();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await session.logout();
  release();
  await assert.rejects(late, /로그인 상태가 변경/);
}
console.log(
  'PASS child API: GET/POST/PUT, auth refresh, 404/409/errors, stale response rejection',
);
