import assert from 'node:assert/strict';
import { loadAuthModule } from './auth-loader.mjs';

const load = (settings, entry = '../src/config/env.ts', globals = {}) =>
  loadAuthModule({ process: { env: settings }, ...globals }, entry);
const configured = { EXPO_PUBLIC_API_URL: 'https://api.example.com///' };

assert.equal(
  load({ EXPO_PUBLIC_APP_ENV: 'staging' }).env.apiBaseUrl,
  undefined,
);
for (const appEnv of ['development', 'staging', 'production']) {
  for (const bypass of [undefined, 'true', 'false']) {
    const { env } = load({
      ...configured,
      EXPO_PUBLIC_APP_ENV: appEnv,
      EXPO_PUBLIC_ENABLE_AUTH_BYPASS: bypass,
    });
    assert.equal(env.appEnv, appEnv);
    assert.equal(env.apiBaseUrl, 'https://api.example.com');
    assert.equal(env.canPreview, appEnv !== 'production' && bypass !== 'false');
    const { AuthSession } = load(
      {
        ...configured,
        EXPO_PUBLIC_APP_ENV: appEnv,
        EXPO_PUBLIC_ENABLE_AUTH_BYPASS: bypass,
      },
      '../src/lib/features/auth/index.ts',
    );
    const client = new AuthSession(
      { read: async () => null, clear: async () => {}, write: async () => {} },
      () => {},
    );
    await client.preview();
    assert.equal(client.getSnapshot().status === 'preview', env.canPreview);
  }
}
assert.equal(load(configured).env.appEnv, 'development');
for (const appEnv of [undefined, 'development', 'production']) {
  assert.throws(
    () => load({ EXPO_PUBLIC_APP_ENV: appEnv }),
    /EXPO_PUBLIC_API_URL/,
  );
}
assert.throws(
  () => load({ ...configured, EXPO_PUBLIC_APP_ENV: 'stagng' }),
  /EXPO_PUBLIC_APP_ENV/,
);
assert.equal(
  load({ EXPO_PUBLIC_APP_ENV: 'staging', EXPO_PUBLIC_API_URL: '  ' }).env
    .apiBaseUrl,
  undefined,
);
let requests = 0;
const { http } = load(
  { EXPO_PUBLIC_APP_ENV: 'staging' },
  '../src/lib/api/http.ts',
  {
    fetch: async () => {
      requests++;
      throw new Error('Unexpected fetch');
    },
  },
);
await assert.rejects(
  http('/api/health'),
  (error) => error.code === 'API_NOT_CONFIGURED',
);
assert.equal(requests, 0);
console.log('Environment and preview policy tests passed');
