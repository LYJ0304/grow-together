import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = await readFile(
  new URL('../src/lib/child-profile.ts', import.meta.url),
  'utf8',
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
  },
});
const values = new Map();
let failRead = false;
let failWrite = false;
const storage = {
  getItem: async (key) => {
    if (failRead) throw new Error('read failed');
    return values.get(key) ?? null;
  },
  setItem: async (key, value) => {
    if (failWrite) throw new Error('write failed');
    values.set(key, value);
  },
};
function load() {
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    Date,
    Error,
    JSON,
    require: (name) => {
      assert.equal(name, '@react-native-async-storage/async-storage');
      return storage;
    },
  });
  return module.exports;
}
const { readChildProfile, saveChildProfile, validateChildProfile } = load();
assert.equal(await readChildProfile('owner-1'), null);
const input = { name: '  하늘  ', birthday: '2024-02-29' };
assert.equal((await saveChildProfile('owner-1', input)).name, '하늘');
assert.equal((await load().readChildProfile('owner-1')).name, '하늘');
assert.equal(await readChildProfile('owner-2'), null);
assert.equal(await readChildProfile('preview'), null);
await saveChildProfile('owner-2', { name: '바다', birthday: '2024-03-15' });
await saveChildProfile('owner-1', { name: '별', birthday: '2024-03-15' });
assert.equal((await readChildProfile('owner-2')).name, '바다');
assert.equal((await readChildProfile('owner-1')).name, '별');
for (const birthday of [
  '2023-02-29',
  '2024-04-31',
  '2024-00-01',
  '0000-01-01',
  '2024/03/15',
  '9999-01-01',
]) {
  assert.ok(validateChildProfile({ name: '하늘', birthday }).birthday);
  await assert.rejects(saveChildProfile('owner-1', { name: '하늘', birthday }));
}
for (const birthday of ['0001-01-01', '0099-12-31', '2000-02-29'])
  assert.equal(
    validateChildProfile({ name: '하늘', birthday }).birthday,
    undefined,
  );
assert.ok(validateChildProfile({ name: ' ', birthday: '2024-03-15' }).name);
const today = new Date();
const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
assert.equal(
  validateChildProfile({ name: '하늘', birthday: date }).birthday,
  undefined,
);
failWrite = true;
await assert.rejects(saveChildProfile('owner-1', input), /저장/);
failWrite = false;
assert.equal((await readChildProfile('owner-1')).name, '별');
failRead = true;
await assert.rejects(readChildProfile('owner-1'), /불러오/);
failRead = false;
const key = [...values.keys()].find((key) => values.get(key).includes('별'));
values.set(key, '{');
await assert.rejects(readChildProfile('owner-1'), /불러오/);
await assert.rejects(readChildProfile(''), /계정/);
console.log(
  'PASS child profile: create/update/restore, validation, account isolation and failure preservation',
);
