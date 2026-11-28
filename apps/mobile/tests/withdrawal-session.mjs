import assert from 'node:assert/strict';
import { loadAuthModule } from './auth-loader.mjs';
const tokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  tokenType: 'Bearer',
  expiresIn: 900,
};
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status });
function setup(handler) {
  let stored = null,
    clears = 0;
  const { AuthSession } = loadAuthModule({
    process: { env: { EXPO_PUBLIC_API_URL: 'http://api.test' } },
    fetch: async (url, init) =>
      url.endsWith('/login') ? json(tokens) : handler(url, init),
  });
  const storage = {
    read: async () => stored,
    write: async (value) => {
      stored = value;
    },
    clear: async () => {
      stored = null;
    },
  };
  const client = new AuthSession(storage, () => clears++);
  return { client, storage, clears: () => clears, stored: () => stored };
}
const login = (client) =>
  client.login({ email: 'test@example.test', password: 'password123' });
{
  let requests = 0;
  const s = setup(async (url, init) => {
    requests++;
    assert(url.endsWith('/users/me/withdrawal'));
    assert.equal(JSON.parse(init.body).password, 'password123');
    assert.equal(
      new Headers(init.headers).get('Authorization'),
      'Bearer access',
    );
    return new Response(null, { status: 204 });
  });
  await login(s.client);
  const before = s.clears();
  await s.client.withdraw('password123');
  assert.equal(s.client.getSnapshot().status, 'signedOut');
  assert.equal(s.stored(), null);
  assert.equal(s.clears(), before + 1);
  assert.equal(requests, 1);
}
for (const status of [400, 401, 500, 0]) {
  let requests = 0;
  const s = setup(async () => {
    requests++;
    if (!status) throw new Error('offline');
    return json(
      { code: status === 400 ? 'INVALID_PASSWORD' : 'UNAUTHORIZED' },
      status,
    );
  });
  await login(s.client);
  await assert.rejects(s.client.withdraw('bad'));
  assert.equal(requests, 1, 'destructive command never refreshes/replays');
  assert.equal(
    s.client.getSnapshot().status,
    status === 401 ? 'signedOut' : 'authenticated',
  );
  assert(!s.client.getSnapshot().notice.includes('완료'));
}
{
  const s = setup(async () => new Response(null, { status: 204 }));
  await login(s.client);
  s.storage.clear = async () => {
    throw new Error('disk');
  };
  await assert.rejects(s.client.withdraw('password123'));
  assert.equal(s.client.getSnapshot().status, 'storageError');
}
{
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const s = setup(async (url) => {
    if (url.endsWith('/logout')) return new Response(null, { status: 204 });
    await gate;
    return new Response(null, { status: 204 });
  });
  await login(s.client);
  const pending = s.client.withdraw('password123');
  await s.client.logout();
  await login(s.client);
  const epoch = s.client.getSnapshot().epoch;
  release();
  await assert.rejects(pending);
  assert.equal(s.client.getSnapshot().status, 'authenticated');
  assert.equal(s.client.getSnapshot().epoch, epoch);
}
console.log(
  'PASS withdrawal success cleanup, wrong password, 401, timeout/server uncertainty, no replay, storage failure, account-switch isolation',
);
