import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = await readFile(
  new URL('../src/lib/diary-storage.ts', import.meta.url),
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
let failWrite = false;
let failRead = false;
const storage = {
  getItem: async (key) => {
    if (failRead) throw new Error('Unavailable');
    return values.get(key) ?? null;
  },
  setItem: async (key, value) => {
    if (failWrite) throw new Error('Quota exceeded');
    values.set(key, value);
  },
  getAllKeys: async () => {
    if (failRead) throw new Error('Unavailable');
    return [...values.keys()];
  },
};
const module = { exports: {} };
vm.runInNewContext(outputText, {
  module,
  exports: module.exports,
  JSON,
  Date,
  Error,
  require: (name) => {
    assert.equal(name, '@react-native-async-storage/async-storage');
    return storage;
  },
});
const { diaryDateKey, parseDiaryDate, saveDiary, readDiary, savedDiaryDates } =
  module.exports;

assert.equal(diaryDateKey(new Date(2026, 9, 10, 23, 59)), '2026-10-10');
assert.equal(parseDiaryDate('2026-02-29'), null);
assert.equal(parseDiaryDate('2026-02-31'), null);
assert.equal(parseDiaryDate('2026-13-01'), null);
assert.equal(parseDiaryDate('invalid'), null);
assert.equal(diaryDateKey(parseDiaryDate('2028-02-29')), '2028-02-29');
assert.equal(await readDiary('2026-10-10'), null);

const diary = {
  date: '2026-10-10',
  content: '오늘은 숟가락을 잡았어요.',
  emotions: ['성취감'],
  growthPoints: ['새로운 시도'],
  photoUris: ['data:image/jpeg;base64,YQ=='],
};
await saveDiary(diary);
assert.deepEqual(await readDiary(diary.date), diary);
await saveDiary({ ...diary, date: '2026-10-11', photoUris: [] });
assert.deepEqual(await savedDiaryDates(), ['2026-10-10', '2026-10-11']);
await assert.rejects(
  saveDiary({ ...diary, content: '덮어쓰지 않아요.' }),
  /이미 저장된 날짜/,
);
assert.deepEqual(
  await readDiary(diary.date),
  diary,
  'Existing diary must remain unchanged',
);

failWrite = true;
await assert.rejects(
  saveDiary({ ...diary, date: '2026-10-12' }),
  /저장하지 못했어요/,
);
failWrite = false;
assert.equal(
  await readDiary('2026-10-12'),
  null,
  'Failed save must not appear as saved',
);
await assert.rejects(
  saveDiary({ ...diary, date: '2026-02-31' }),
  /내용을 확인/,
);
await assert.rejects(
  saveDiary({ ...diary, photoUris: ['blob:temporary-photo'] }),
  /내용을 확인/,
);
await assert.rejects(
  saveDiary({
    ...diary,
    photoUris: ['data:image/jpeg;base64,' + 'a'.repeat(1_500_000)],
  }),
  /사진 용량/,
);

const prefix = [...values.keys()][0].slice(0, -10);
values.set(prefix + '2026-10-12', '{broken');
await assert.rejects(readDiary('2026-10-12'), /불러오지 못했어요/);
assert.equal(
  values.get(prefix + '2026-10-12'),
  '{broken',
  'Corrupt data must not be silently removed',
);
values.set(
  prefix + '2026-10-13',
  JSON.stringify({ ...diary, date: '2026-10-14' }),
);
await assert.rejects(readDiary('2026-10-13'), /불러오지 못했어요/);
values.set(prefix + '2026-02-31', 'invalid date');
values.set('unrelated-key', 'value');
assert.ok(!(await savedDiaryDates()).includes('2026-02-31'));
failRead = true;
await assert.rejects(savedDiaryDates(), /목록을 불러오지 못했어요/);
await assert.rejects(readDiary(diary.date), /불러오지 못했어요/);
await assert.rejects(
  saveDiary({ ...diary, date: '2026-10-15' }),
  /저장소를 확인하지 못했어요/,
);
console.log(
  'PASS: local dates, save/read, durable photos, duplicate protection, failed writes, invalid/corrupt data, storage failures',
);
