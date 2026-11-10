import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function load(path) {
  const module = { exports: {} };
  const source = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    },
  ).outputText;
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    Date,
    Error,
    JSON,
    require: (name) =>
      name.startsWith('./') ? load('../src/lib/' + name.slice(2) + '.ts') : {},
  });
  return module.exports;
}
const m = load('../src/lib/onboarding.ts');
assert.equal(m.ageInMonths('2022-11-10', '2026-11-10'), 48);
assert.equal(m.ageInMonths('2022-10-10', '2026-11-10'), 49);
assert.equal(m.ageInMonths('2024-02-29', '2024-03-28'), 0);
assert.equal(m.ageInMonths('2024-02-29', '2024-03-29'), 1);
assert.equal(m.ageInMonths('2026-11-10', '2026-11-10'), 0);
assert.deepEqual([...m.toggleConcern(['sleep'], 'none')], ['none']);
assert.deepEqual([...m.toggleConcern(['none'], 'feeding')], ['feeding']);
assert.deepEqual(
  [...m.toggleConcern(['sleep', 'feeding'], 'communication')],
  ['sleep', 'feeding'],
);
assert.deepEqual([...m.toggleConcern(['sleep'], 'sleep')], []);
const profile = {
  name: '하늘',
  birthday: '2024-03-15',
  personalization: m.emptyPersonalization(),
};
assert.equal(Object.keys(m.validateOnboarding(profile)).length, 0);
assert(m.validateOnboarding({ ...profile, birthday: '2024-02-30' }).birthday);
assert(
  m.validateOnboarding({
    ...profile,
    personalization: {
      ...profile.personalization,
      expectedDueDate: '2024-04-15',
    },
  }).expectedDueDate,
);
assert(
  m.validateOnboarding({
    ...profile,
    personalization: {
      ...profile.personalization,
      prematurityStatus: 'yes',
      expectedDueDate: '2024-03-15',
    },
  }).expectedDueDate,
);
assert.equal(
  Object.keys(
    m.validateOnboarding({
      ...profile,
      personalization: {
        ...profile.personalization,
        prematurityStatus: 'yes',
        expectedDueDate: '2099-01-01',
      },
    }),
  ).length,
  0,
);
assert(
  m.validateOnboarding({
    ...profile,
    personalization: {
      ...profile.personalization,
      concerns: ['none', 'sleep'],
    },
  }).concerns,
);
assert.equal(
  m.personalizationSaved(profile, {
    name: profile.name,
    birthday: profile.birthday,
  }),
  false,
);
assert.equal(m.personalizationSaved(profile, profile), true);
console.log(
  'PASS onboarding model: dates/month boundaries, concerns, due dates, verified save',
);

const { createDraftStore } = load('../src/lib/onboarding-draft.ts');
const values = new Map();
let failRead = false;
const store = createDraftStore({
  getItem: async (key) => {
    if (failRead) throw new Error('raw storage error');
    return values.get(key) ?? null;
  },
  setItem: async (key, value) => {
    values.set(key, value);
  },
  removeItem: async (key) => {
    values.delete(key);
  },
});
const draft = { profile, mode: 'create', step: 2, savedAt: 1000 };
await store.write('owner1', draft);
assert.equal((await store.read('owner1', 1001)).step, 2);
assert.equal(await store.read('owner2', 1001), null);
assert.equal(await store.read('owner1', 1000 + 24 * 60 * 60 * 1000), null);
const pending = store.write('owner1', draft);
await store.clearAll();
await pending;
assert.equal(values.size, 0);
failRead = true;
await assert.rejects(store.read('owner1'), /임시 입력/);
console.log(
  'PASS onboarding drafts: account isolation, expiry, logout race, readable storage failure',
);

const preterm = {
  ...m.emptyPersonalization(),
  prematurityStatus: 'yes',
  expectedDueDate: '2024-04-15',
};
assert.equal(m.withPrematurity(preterm, null).expectedDueDate, null);
assert.equal(m.withPrematurity(preterm, 'no').expectedDueDate, null);
assert.equal(m.withPrematurity(preterm, 'unknown').expectedDueDate, null);
assert.equal(m.withPrematurity(preterm, 'yes').expectedDueDate, '2024-04-15');

failRead = false;
await store.write('owner1', draft);
const restarted = createDraftStore({
  getItem: async (k) => values.get(k) ?? null,
  setItem: async (k, v) => {
    values.set(k, v);
  },
  removeItem: async (k) => {
    values.delete(k);
  },
});
await restarted.clearAll('owner1');
assert.equal(
  values.size,
  0,
  'logout clears the known owner even after restarting without opening the draft',
);
