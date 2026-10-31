import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { loadAuthModule } from './auth-loader.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/lib/features/todo/todoApi.ts', import.meta.url),
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
        assert.fail('Todo requests must use the authenticated session'),
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
const { createTodoApi } = module.exports;
assert.equal(
  typeof createTodoApi,
  'function',
  'Todo API must accept an authenticated session',
);

const input = {
  planName: '산책',
  content: '아이와 함께 산책',
  scheduledDate: '2026-10-31',
  scheduledTime: '09:00:00',
};
const todo = { id: 42, ...input };
const created = { message: 'Todo created Successful' };
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
      path: new URL(url).pathname + new URL(url).search,
      method: init.method,
      body: init.body,
    });
    if (init.body)
      assert.equal(init.headers.get('Content-Type'), 'application/json');
    if (init.method === 'DELETE') return new Response(null, { status: 204 });
    if (init.method === 'POST') return json(created, 201);
    if (new URL(url).searchParams.has('date')) {
      return json(
        new URL(url).searchParams.get('date') === input.scheduledDate
          ? [todo]
          : [],
      );
    }
    return json(todo);
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
const api = createTodoApi(session);
await assert.rejects(api.getTodo(42), (error) => error.status === 401);
await session.login({ email: 'user@example.com', password: 'password123' });
assert.deepEqual(await api.createTodo(input), created);
assert.deepEqual(await api.getTodos(input.scheduledDate), [todo]);
assert.deepEqual(await api.getTodos('2026-11-01'), []);
assert.deepEqual(await api.getTodo(42), todo);
assert.deepEqual(await api.updateTodo(42, input), todo);
assert.equal(await api.deleteTodo(42), undefined);
assert.equal(refreshes, 1);
assert.deepEqual(requests, [
  { path: '/api/v1/todos', method: 'POST', body: JSON.stringify(input) },
  { path: '/api/v1/todos?date=2026-10-31', method: 'GET', body: undefined },
  { path: '/api/v1/todos?date=2026-11-01', method: 'GET', body: undefined },
  { path: '/api/v1/todos/42', method: 'GET', body: undefined },
  { path: '/api/v1/todos/42', method: 'PUT', body: JSON.stringify(input) },
  { path: '/api/v1/todos/42', method: 'DELETE', body: undefined },
]);
failRequest = true;
await assert.rejects(api.deleteTodo(42), (error) => error.status === 403);
console.log(
  'Todo API checks passed (CRUD, URLs, authentication, refresh, 204, errors)',
);
