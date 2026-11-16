import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const data = new Map();
const storage = {
  getItem: async (key) => data.get(key) ?? null,
  setItem: async (key, value) => data.set(key, value),
};
const module = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL('../src/lib/diary-storage.ts', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    },
  ).outputText,
  { module, exports: module.exports, require: () => storage, Date },
);
const api = module.exports;
const photo = 'data:image/jpeg;base64,YQ==';
await api.saveDiary({
  date: '2026-11-15',
  content: '첫 기록',
  photoUris: [photo],
  emotions: ['기쁨'],
  growthPoints: [],
  sourceRecords: { activities: ['책'], note: '웃음', tags: [] },
});
const edited = await api.updateDiary('2026-11-15', '사진 제거', []);
assert.equal(
  edited.photoUris.length,
  0,
  'explicit photo removal must be persisted',
);
assert.equal(edited.emotions[0], '기쁨');
assert.equal(edited.sourceRecords.note, '웃음');
await api.updateDiary('2026-11-15', '사진 추가', [photo]);
const bodyOnly = await api.updateDiary('2026-11-15', '글만 변경');
assert.equal(
  bodyOnly.photoUris[0],
  photo,
  'omitted photo change preserves existing attachment',
);
await assert.rejects(() => api.updateDiary('2026-11-15', '', []));
await assert.rejects(() =>
  api.updateDiary('2026-11-15', '초과 사진', [photo, photo, photo, photo]),
);
assert.equal((await api.readDiary('2026-11-15')).content, '글만 변경');
console.log(
  'PASS preview photo edit/removal, body-only preservation, metadata and content validation',
);
