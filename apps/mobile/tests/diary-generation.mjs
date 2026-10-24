import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
const source = await readFile(
  new URL('../src/lib/diary-generation.ts', import.meta.url),
  'utf8',
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
const module = { exports: {} };
vm.runInNewContext(outputText, { module, exports: module.exports, Error });
const { generateDiary } = module.exports;
await assert.rejects(
  generateDiary(new Date(2026, 9, 12), {
    activities: [],
    note: '  ',
    tags: [],
  }),
  /활동을 선택/,
);
const result = await generateDiary(new Date(2026, 9, 12), {
  activities: ['책 읽기'],
  note: '  책장을 넘겼어요.  ',
  tags: ['#성취/시도'],
});
assert(result.content.includes('책 읽기'));
assert(result.content.includes('책장을 넘겼어요.'));
assert(result.content.includes('#성취/시도'));
assert.equal(result.emotions.length, 0);
assert.equal(result.growthPoints.length, 0);
assert.equal(result.tomorrowTip, undefined);
console.log(
  'PASS mock uses only selected activities/notes/tags, refuses empty input, does not invent analysis',
);
