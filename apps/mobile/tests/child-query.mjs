import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = ts.transpileModule(
  readFileSync(
    new URL('../src/lib/use-child-profile.ts', import.meta.url),
    'utf8',
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
let auth;
let options;
let focus;
const calls = [];
const refetch = () => {
  calls.push('refetch');
};
const module = { exports: {} };
vm.runInNewContext(source, {
  exports: module.exports,
  require: (name) => {
    if (name === 'react') return { useCallback: (callback) => callback };
    if (name === 'expo-router')
      return {
        useFocusEffect: (callback) => {
          focus = callback;
        },
      };
    if (name === '@tanstack/react-query')
      return {
        useQuery: (input) => {
          options = input;
          return { refetch };
        },
      };
    if (name === '../components/auth-provider') return { useAuth: () => auth };
    if (name === './child-profile')
      return {
        readChildProfile: async (key) => {
          calls.push(['local', key]);
          return null;
        },
      };
    if (name === './features/child/childApi')
      return {
        createChildApi: (client) => ({
          getProfile: async () => {
            calls.push(['api', client]);
            return { name: '서버', birthday: '2024-02-29' };
          },
        }),
      };
    assert.fail(`Unexpected import: ${name}`);
  },
});
const client = {};
auth = { client, status: 'authenticated', accountKey: 'user-1', epoch: 1 };
module.exports.useChildProfile();
assert.equal(options.enabled, true);
assert.equal((await options.queryFn()).name, '서버');
assert.deepEqual(calls, [['api', client]]);
assert.deepEqual(Array.from(options.queryKey), ['childProfile', 'user-1', 1]);
calls.length = 0;
auth = { client, status: 'preview', accountKey: 'preview', epoch: 2 };
module.exports.useChildProfile();
assert.equal(options.enabled, true);
assert.equal(await options.queryFn(), null);
assert.deepEqual(calls, [['local', 'preview']]);
for (const status of ['restoring', 'signedOut', 'restoreError']) {
  calls.length = 0;
  auth = { client, status, accountKey: null, epoch: 3 };
  module.exports.useChildProfile();
  assert.equal(options.enabled, false);
  focus();
  assert.deepEqual(calls, []);
}
console.log(
  'PASS child query: server for authenticated users, local preview, disabled outside session',
);
