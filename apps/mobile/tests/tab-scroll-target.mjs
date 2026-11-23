import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url),
  ts = require('typescript');
for (const reduced of [false, true]) {
  let adapter;
  const module = { exports: {} };
  const source = ts.transpileModule(
    readFileSync(
      new URL('../src/lib/use-tab-scroll-to-top.ts', import.meta.url),
      'utf8',
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require: (name) =>
      name === 'react'
        ? { useMemo: (fn) => fn() }
        : name === 'expo-router/react-navigation'
          ? {
              useScrollToTop: (value) => {
                adapter = value;
              },
            }
          : { useReduceMotion: () => reduced },
  });
  const calls = [];
  module.exports.useTabScrollToTop({
    current: { scrollTo: (options) => calls.push(options) },
  });
  adapter.current.scrollToTop();
  assert.equal(calls[0].y, 0);
  assert.equal(calls[0].animated, !reduced);
  module.exports.useTabScrollToTop({
    current: { scrollToOffset: (options) => calls.push(options) },
  });
  adapter.current.scrollToTop();
  assert.equal(calls[1].offset, 0);
  assert.equal(calls[1].animated, !reduced);
}
console.log(
  'PASS tab reselect scroll adapters: ScrollView/FlatList and Reduce Motion',
);
