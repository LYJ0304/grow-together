import assert from 'node:assert/strict';
import { loadAuthModule } from './auth-loader.mjs';

const pair = (id) => ({
  accessToken: `access-${id}`,
  refreshToken: `refresh-${id}`,
  tokenType: 'Bearer',
  expiresIn: 900,
});
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status });
const unauthorized = () => json({ code: 'UNAUTHORIZED' }, 401);
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
function setup(handler, saved = null, preview) {
  let stored = saved;
  let clears = 0;
  const cache = new Map([['old-user', 'private']]);
  const storage = {
    read: async () => stored,
    write: async (v) => {
      stored = v;
    },
    clear: async () => {
      stored = null;
    },
  };
  const { AuthSession } = loadAuthModule({
    process: {
      env: {
        EXPO_PUBLIC_API_URL: 'http://localhost:18069',
        EXPO_PUBLIC_ENABLE_AUTH_BYPASS: preview,
      },
    },
    fetch: handler,
  });
  const client = new AuthSession(storage, () => {
    clears++;
    cache.clear();
  });
  return { client, storage, cache, stored: () => stored, clears: () => clears };
}
const login = (c) =>
  c.login({ email: 'user@example.com', password: 'password123' });

// Concurrent and late old-token 401s share one rotation, persisted as a single pair.
{
  let refreshes = 0;
  let oldRequests = 0;
  const gate = deferred();
  const late = deferred();
  const s = setup(async (url, init) => {
    if (url.endsWith('/login')) return json(pair(1));
    if (url.endsWith('/refresh')) {
      refreshes++;
      assert.equal(JSON.parse(init.body).refreshToken, 'refresh-1');
      await gate.promise;
      return json(pair(2));
    }
    assert.equal(init.headers.get('X-Test'), 'kept');
    if (init.headers.get('Authorization') === 'Bearer access-1') {
      if (++oldRequests === 3) await late.promise;
      return unauthorized();
    }
    assert.equal(init.headers.get('Authorization'), 'Bearer access-2');
    return json([]);
  });
  await login(s.client);
  assert.equal(s.cache.size, 0);
  const requests = [1, 2, 3].map(() =>
    s.client.request('/api/v1/todos', {
      headers: new Headers({ 'X-Test': 'kept' }),
    }),
  );
  await tick();
  assert.equal(refreshes, 1);
  gate.resolve();
  await requests[0];
  late.resolve();
  await Promise.all(requests);
  assert.equal(refreshes, 1);
  assert.deepEqual(JSON.parse(s.stored()), pair(2));
}
// Retry limit and invalid session cleanup.
{
  let refreshes = 0;
  const s = setup(async (url) => {
    if (url.endsWith('/login')) return json(pair(1));
    if (url.endsWith('/refresh')) {
      refreshes++;
      return json(pair(2));
    }
    return unauthorized();
  });
  await login(s.client);
  await assert.rejects(
    s.client.request('/api/v1/todos'),
    (e) => e.status === 401,
  );
  assert.equal(refreshes, 1);
  assert.equal(s.stored(), null);
  assert.equal(s.client.getSnapshot().status, 'signedOut');
}
{
  const s = setup(async () => unauthorized(), JSON.stringify(pair(1)));
  await s.client.restore();
  assert.equal(s.stored(), null);
  assert.equal(s.client.getSnapshot().status, 'signedOut');
}
// Offline startup preserves credentials. Explicit logout clears locally even offline.
{
  const s = setup(
    async () => {
      throw new Error('offline');
    },
    JSON.stringify(pair(1)),
  );
  await s.client.restore();
  assert.equal(s.client.getSnapshot().status, 'restoreError');
  assert.deepEqual(JSON.parse(s.stored()), pair(1));
  await s.client.logout();
  assert.equal(s.stored(), null);
  assert.match(s.client.getSnapshot().notice, /서버 연결 실패/);
}
{
  let refreshes = 0;
  const s = setup(
    async () => {
      refreshes++;
      return json(pair(2));
    },
    JSON.stringify(pair(1)),
  );
  await Promise.all([s.client.restore(), s.client.restore()]);
  assert.equal(refreshes, 1);
  assert.equal(s.client.getSnapshot().status, 'authenticated');
  assert.deepEqual(JSON.parse(s.stored()), pair(2));
}
// Logout wins over pending refresh and old-account success responses.
{
  const rotation = deferred();
  const oldResponse = deferred();
  const s = setup(async (url) => {
    if (url.endsWith('/login')) return json(pair(1));
    if (url.endsWith('/refresh')) {
      await rotation.promise;
      return json(pair(2));
    }
    if (url.endsWith('/logout')) return new Response(null, { status: 204 });
    if (url.endsWith('/slow')) {
      await oldResponse.promise;
      return json({ private: true });
    }
    return unauthorized();
  });
  await login(s.client);
  const pending = assert.rejects(
    s.client.request('/api/v1/todos'),
    /로그인 상태가 변경/,
  );
  const old = assert.rejects(
    s.client.request('/api/v1/slow'),
    /로그인 상태가 변경/,
  );
  await tick();
  await s.client.logout();
  rotation.resolve();
  oldResponse.resolve();
  await Promise.all([pending, old]);
  assert.equal(s.stored(), null);
  assert.equal(s.client.getSnapshot().status, 'signedOut');
}
// A late logout response cannot overwrite a newly logged-in account or its cache.
{
  const gate = deferred();
  let logins = 0;
  const s = setup(async (url) => {
    if (url.endsWith('/login')) return json(pair(++logins));
    if (url.endsWith('/logout')) {
      await gate.promise;
      throw new Error('offline');
    }
    return json([]);
  });
  await login(s.client);
  const logout = s.client.logout();
  await tick();
  await login(s.client);
  s.cache.set('new-user', 'new-data');
  gate.resolve();
  await logout;
  assert.equal(s.client.getSnapshot().status, 'authenticated');
  assert.deepEqual(JSON.parse(s.stored()), pair(2));
  assert.equal(s.cache.get('new-user'), 'new-data');
  assert.equal(s.clears(), 3);
}
// Storage write races and storage failures fail closed.
{
  const gate = deferred();
  const started = deferred();
  const s = setup(async (url) =>
    url.endsWith('/logout')
      ? new Response(null, { status: 204 })
      : json(pair(1)),
  );
  const write = s.storage.write;
  s.storage.write = async (v) => {
    started.resolve();
    await gate.promise;
    await write(v);
  };
  const loggingIn = assert.rejects(login(s.client), /로그인 상태가 변경/);
  await started.promise;
  const logout = s.client.logout();
  gate.resolve();
  await Promise.all([loggingIn, logout]);
  assert.equal(s.stored(), null);
}
{
  const s = setup(async (url) =>
    url.endsWith('/login')
      ? json(pair(1))
      : url.endsWith('/refresh')
        ? json(pair(2))
        : unauthorized(),
  );
  await login(s.client);
  s.storage.write = async () => {
    throw new Error('disk full');
  };
  await assert.rejects(s.client.request('/api/v1/todos'), /disk full/);
  assert.equal(s.client.getSnapshot().status, 'signedOut');
  assert.equal(s.stored(), null);
}
{
  const s = setup(async () => json(pair(1)));
  await login(s.client);
  s.storage.clear = async () => {
    throw new Error('disk blocked');
  };
  await s.client.logout();
  assert.equal(s.client.getSnapshot().status, 'storageError');
  await assert.rejects(
    s.client.request('/api/v1/todos'),
    (e) => e.status === 401,
  );
}
// Staging QA preview defaults on, honors opt-out, and never authenticates API requests.
for (const [setting, enabled] of [
  [undefined, true],
  ['true', true],
  ['false', false],
  ['', false],
  ['invalid', false],
]) {
  const s = setup(
    async () => {
      throw new Error('must not fetch');
    },
    null,
    setting,
  );
  await s.client.restore();
  await s.client.preview();
  assert.equal(
    s.client.getSnapshot().status,
    enabled ? 'preview' : 'signedOut',
  );
  await assert.rejects(
    s.client.request('/api/v1/todos'),
    (e) => e.status === 401,
  );
}
{
  let count = 0;
  const s = setup(async () => {
    count++;
    return json({ code: 'EMAIL_ALREADY_EXISTS', message: 'duplicate' }, 409);
  });
  await assert.rejects(
    s.client.signup({
      name: '테스트',
      email: 'user@example.com',
      password: 'password123',
    }),
    (e) =>
      e.status === 409 &&
      e.code === 'EMAIL_ALREADY_EXISTS' &&
      /이미 가입/.test(e.message),
  );
  assert.equal(count, 1);
}
// Invalid persisted or rotated data cannot be restored as an authenticated session.
{
  const s = setup(async () => {
    throw new Error('must not fetch');
  }, '{broken');
  await s.client.restore();
  assert.equal(s.stored(), null);
  assert.equal(s.client.getSnapshot().status, 'signedOut');
}
{
  const s = setup(
    async () => json({ accessToken: 'incomplete' }),
    JSON.stringify(pair(1)),
  );
  await s.client.restore();
  assert.equal(s.stored(), null);
  assert.equal(s.client.getSnapshot().status, 'signedOut');
}
{
  let offline = true;
  const s = setup(
    async () => {
      if (offline) throw new Error('offline');
      return json(pair(2));
    },
    JSON.stringify(pair(1)),
  );
  await s.client.restore();
  assert.equal(s.client.getSnapshot().status, 'restoreError');
  offline = false;
  await s.client.restore();
  assert.equal(s.client.getSnapshot().status, 'authenticated');
  assert.deepEqual(JSON.parse(s.stored()), pair(2));
}
// A login completing after logout is revoked without restoring local credentials.
{
  const gate = deferred();
  let revoked = false;
  const s = setup(async (url) => {
    if (url.endsWith('/login')) {
      await gate.promise;
      return json(pair(1));
    }
    if (url.endsWith('/logout')) {
      revoked = true;
      return new Response(null, { status: 204 });
    }
    throw new Error('unexpected call');
  });
  const pending = assert.rejects(login(s.client), /로그인 상태가 변경/);
  await tick();
  await s.client.logout();
  gate.resolve();
  await pending;
  await tick();
  assert.equal(revoked, true);
  assert.equal(s.stored(), null);
  assert.equal(s.client.getSnapshot().status, 'signedOut');
}
// Auth endpoints use the shared HTTP headers and cancel timed-out requests.
{
  const s = setup(async (url, init) => {
    assert.equal(url, 'http://localhost:18069/api/v1/auth/signup');
    assert.equal(init.headers.get('Accept'), 'application/json');
    assert.equal(init.headers.get('Content-Type'), 'application/json');
    assert.equal(JSON.parse(init.body).name, '테스트');
    return json({ message: 'Signup Successful' }, 201);
  });
  await s.client.signup({
    name: '테스트',
    email: 'user@example.com',
    password: 'password123',
  });
}
{
  let expire;
  let cleared = false;
  const { AuthSession } = loadAuthModule({
    process: { env: { EXPO_PUBLIC_API_URL: 'http://localhost:18069' } },
    setTimeout: (callback, delay) => {
      assert.equal(delay, 15000);
      expire = callback;
      return 1;
    },
    clearTimeout: (timer) => {
      assert.equal(timer, 1);
      cleared = true;
    },
    fetch: async (_url, init) => {
      expire();
      assert.equal(init.signal.aborted, true);
      throw new Error('aborted');
    },
  });
  const client = new AuthSession({}, () => {});
  await assert.rejects(
    client.signup({
      name: '테스트',
      email: 'user@example.com',
      password: 'password123',
    }),
    (error) => error.status === 0 && error.code === 'NETWORK_ERROR',
  );
  assert.equal(cleared, true);
}
// API response schemas reject malformed success responses before storage.
for (const value of [
  null,
  {},
  { ...pair(1), accessToken: '' },
  { ...pair(1), accessToken: 123 },
  { ...pair(1), refreshToken: '' },
  { ...pair(1), refreshToken: null },
  { ...pair(1), tokenType: 'Basic' },
  { ...pair(1), expiresIn: '900' },
  { ...pair(1), expiresIn: 0 },
  { ...pair(1), expiresIn: -1 },
  { ...pair(1), expiresIn: 1.5 },
]) {
  const s = setup(async () => json(value));
  await assert.rejects(login(s.client), /로그인 응답을 확인하지 못했어요/);
  assert.equal(s.stored(), null);
  assert.equal(s.client.getSnapshot().status, 'signedOut');

  const restored = setup(async () => json(value), JSON.stringify(pair(1)));
  await restored.client.restore();
  assert.equal(restored.stored(), null);
  assert.equal(restored.client.getSnapshot().status, 'signedOut');

  const persisted = setup(async () => {
    throw new Error('invalid stored tokens must not reach the API');
  }, JSON.stringify(value));
  await persisted.client.restore();
  assert.equal(persisted.stored(), null);
  assert.equal(persisted.client.getSnapshot().status, 'signedOut');
}
for (const value of [null, {}, { message: 123 }, undefined]) {
  const s = setup(async () =>
    value === undefined
      ? new Response(null, { status: 204 })
      : json(value, 201),
  );
  await assert.rejects(
    s.client.signup({
      name: '테스트',
      email: 'user@example.com',
      password: 'password123',
    }),
    /회원가입 응답을 확인하지 못했어요/,
  );
}
{
  const s = setup(async (url) =>
    url.endsWith('/login')
      ? json({ ...pair(1), extra: 'not part of the token contract' })
      : json({ unexpected: 'logout response' }),
  );
  await login(s.client);
  assert.deepEqual(JSON.parse(s.stored()), pair(1));
  await s.client.logout();
  assert.equal(s.stored(), null);
  assert.match(s.client.getSnapshot().notice, /서버 연결 실패/);
}
console.log('Auth session checks passed');
