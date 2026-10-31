import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
const source = readFileSync(
  new URL('../src/lib/api/client.ts', import.meta.url),
  'utf8',
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
});
let request;
const context = {
  exports: {},
  Headers,
  require: (specifier) => {
    assert.equal(specifier, './http');
    return {
      http: async (endpoint, options) => {
        request = {
          endpoint,
          ...options,
          headers: new Headers(options.headers),
        };
      },
    };
  },
};
vm.runInNewContext(outputText, context);
const { client, createClient } = context.exports;

for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
  const send = (headers) =>
    client[method](
      '/items',
      ...(['post', 'put', 'patch'].includes(method)
        ? [{ value: 1 }, { headers }]
        : [{ headers }]),
    );

  await send(undefined);
  assert.equal(request.headers.get('Content-Type'), 'application/json');
  assert.equal(request.headers.get('X-Custom-Headers'), 'my-custom-value');

  for (const headers of [
    { Authorization: 'Bearer token', 'content-type': 'application/custom' },
    new Headers({
      Authorization: 'Bearer token',
      'content-type': 'application/custom',
    }),
    [
      ['Authorization', 'Bearer token'],
      ['content-type', 'application/custom'],
    ],
  ]) {
    await send(headers);
    assert.equal(request.headers.get('Authorization'), 'Bearer token');
    assert.equal(request.headers.get('Content-Type'), 'application/custom');
    assert.equal(request.headers.get('X-Custom-Headers'), 'my-custom-value');
    assert.equal(new Headers(headers).get('X-Custom-Headers'), null);
  }
}

assert.equal(
  typeof createClient,
  'function',
  'Client must support an authenticated request function',
);
const calls = [];
const result = { id: 42 };
const authenticated = createClient(async (endpoint, options) => {
  calls.push({ endpoint, ...options });
  return result;
});
for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
  const hasBody = ['post', 'put', 'patch'].includes(method);
  assert.equal(
    await authenticated[method](
      '/api/v1/diary/42',
      ...(hasBody ? [{ content: 'diary' }] : []),
    ),
    result,
  );
  const call = calls.at(-1);
  assert.equal(call.endpoint, '/api/v1/diary/42');
  assert.equal(call.method, method.toUpperCase());
  assert.equal(
    call.body,
    hasBody ? JSON.stringify({ content: 'diary' }) : undefined,
  );
}
const failure = new Error('Request failed');
const failing = createClient(async () => {
  throw failure;
});
await assert.rejects(
  failing.get('/api/v1/diary/42'),
  (error) => error === failure,
);
const lastRequest = request;
await client.get('/api/health');
assert.notEqual(request, lastRequest);
assert.equal(request.endpoint, '/api/health');

console.log(
  'API client checks passed (headers, methods, bodies, request injection, errors, public client)',
);
