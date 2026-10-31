import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { loadAuthModule } from './auth-loader.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/lib/features/diary/diaryApi.ts', import.meta.url),
    'utf8',
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
);
const module = { exports: {} };
const clientModule = { exports: {} };
const clientSource = ts.transpileModule(
  readFileSync(new URL('../src/lib/api/client.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
vm.runInNewContext(clientSource, {
  exports: clientModule.exports,
  Headers,
  require: (name) => {
    assert.equal(name, './http');
    return {
      http: () =>
        assert.fail('Diary requests must use the authenticated session'),
    };
  },
});
vm.runInNewContext(outputText, {
  module,
  exports: module.exports,
  require: (name) => {
    assert.equal(name, '../../api/client');
    return clientModule.exports;
  },
});
const { createDiaryApi } = module.exports;
assert.equal(
  typeof createDiaryApi,
  'function',
  'Diary API must accept an authenticated session',
);

const input = { content: '오늘의 일기', todoIds: [2], diaryFiles: [] };
const diary = { id: 42, content: input.content, todos: [], diaryFiles: [] };
const requests = [];
let refreshes = 0;
let failRequest = false;
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status });
const tokens = (id) => ({
  accessToken: `access-${id}`,
  refreshToken: `refresh-${id}`,
  tokenType: 'Bearer',
  expiresIn: 900,
});
const { AuthSession } = loadAuthModule({
  process: { env: { EXPO_PUBLIC_API_URL: 'http://localhost:18069' } },
  fetch: async (url, init) => {
    if (url.endsWith('/login')) return json(tokens(1));
    if (url.endsWith('/refresh')) {
      refreshes++;
      return json(tokens(2));
    }
    const token = init.headers.get('Authorization');
    assert.ok(token?.startsWith('Bearer access-'));
    if (failRequest) return json({ code: 'FORBIDDEN' }, 403);
    if (token === 'Bearer access-1') return json({ code: 'UNAUTHORIZED' }, 401);
    requests.push({
      path: new URL(url).pathname,
      method: init.method,
      body: init.body,
    });
    if (init.body)
      assert.equal(init.headers.get('Content-Type'), 'application/json');
    return init.method === 'DELETE'
      ? new Response(null, { status: 204 })
      : json(diary);
  },
});
const session = new AuthSession(
  {
    read: async () => null,
    write: async () => {},
    clear: async () => {},
  },
  () => {},
);
const api = createDiaryApi(session);
await assert.rejects(api.getDiary(42), (error) => error.status === 401);
await session.login({ email: 'user@example.com', password: 'password123' });
assert.deepEqual(await api.createDiary(input), diary);
assert.deepEqual(await api.getDiary(42), diary);
assert.deepEqual(await api.updateDiary(42, input), diary);
assert.equal(await api.deleteDiary(42), undefined);
assert.equal(refreshes, 1);
assert.deepEqual(requests, [
  { path: '/api/v1/diary', method: 'POST', body: JSON.stringify(input) },
  { path: '/api/v1/diary/42', method: 'GET', body: undefined },
  { path: '/api/v1/diary/42', method: 'PUT', body: JSON.stringify(input) },
  { path: '/api/v1/diary/42', method: 'DELETE', body: undefined },
]);
failRequest = true;
await assert.rejects(api.deleteDiary(42), (error) => error.status === 403);
console.log(
  'Diary API checks passed (CRUD, URLs, authentication, refresh, 204, errors)',
);
