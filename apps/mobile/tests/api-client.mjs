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
const { client } = context.exports;

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

console.log(
  'API client header checks passed (5 methods, all HeadersInit forms)',
);
