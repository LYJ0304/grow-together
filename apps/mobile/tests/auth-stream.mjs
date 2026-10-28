import assert from 'node:assert/strict';
import { loadAuthModule } from './auth-loader.mjs';
const tokens = (id) => ({
  accessToken: `access-${id}`,
  refreshToken: `refresh-${id}`,
  tokenType: 'Bearer',
  expiresIn: 900,
});
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status });
let refreshes = 0;
const { AuthSession } = loadAuthModule({
  process: { env: { EXPO_PUBLIC_API_URL: 'http://localhost:18069' } },
  fetch: async (url) => {
    if (url.endsWith('/login')) return json(tokens(1));
    if (url.endsWith('/refresh')) {
      refreshes++;
      return json(tokens(2));
    }
    return json({});
  },
});
const auth = new AuthSession(
  { read: async () => null, write: async () => {}, clear: async () => {} },
  () => {},
);
await auth.login({ email: 'test@example.com', password: 'password' });
let calls = 0;
const controller = new AbortController();
const response = await auth.stream(
  '/api/v1/chat-threads/test/runs',
  { signal: controller.signal },
  async (url, init) => {
    assert.equal(url, 'http://localhost:18069/api/v1/chat-threads/test/runs');
    assert.equal(init.signal, controller.signal);
    assert.equal(init.headers.get('Accept'), 'text/event-stream');
    if (++calls === 1) return json({}, 401);
    assert.equal(init.headers.get('Authorization'), 'Bearer access-2');
    return new Response('data: {"type":"RUN_FINISHED"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  },
);
assert.equal(calls, 2);
assert.equal(refreshes, 1);
assert.match(await response.text(), /RUN_FINISHED/);
await assert.rejects(auth.stream('/api/v1/auth/login', {}, fetch));
await auth.logout();
await assert.rejects(auth.stream('/api/v1/chat-threads/test/runs', {}, fetch));
console.log(
  'PASS authenticated streams refresh only before opening, preserve abort and reject signed-out/auth paths',
);
