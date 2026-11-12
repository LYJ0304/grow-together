import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync(
  new URL('../src/lib/haptics.ts', import.meta.url),
  'utf8',
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
for (const platform of ['ios', 'android', 'web']) {
  let selections = 0,
    successes = 0;
  const module = { exports: {} };
  const haptics = {
    selectionAsync: async () => {
      selections++;
      throw new Error('Unavailable device feedback');
    },
    notificationAsync: async () => {
      successes++;
    },
    NotificationFeedbackType: { Success: 'success' },
  };
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require: (name) =>
      name === 'react-native' ? { Platform: { OS: platform } } : haptics,
  });
  assert.equal(typeof module.exports.selectionFeedback, 'function');
  module.exports.selectionFeedback();
  await Promise.resolve();
  assert.equal(selections, platform === 'web' ? 0 : 1);
  assert.equal(successes, 0, 'Tab selection must not signal a successful save');
  module.exports.successFeedback();
  await Promise.resolve();
  assert.equal(successes, platform === 'web' ? 0 : 1);
}
console.log(
  'PASS native selection feedback, safe unavailable-device fallback, web no-op and existing save feedback',
);
