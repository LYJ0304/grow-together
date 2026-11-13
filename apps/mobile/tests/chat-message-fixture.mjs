import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require: (name) => {
      if (name === 'react-native') return require('react-native-web');
      if (!name.startsWith('.')) return require(name);
      const target = path.resolve(path.dirname(file), name);
      return load(
        ['.ts', '.tsx']
          .map((ext) => target + ext)
          .find((p) => {
            try {
              readFileSync(p);
              return true;
            } catch {
              return false;
            }
          }),
      );
    },
  });
  return module.exports;
}
const { ChatMessageList } = load(
  path.resolve('src/components/chat/chat-message-list.tsx'),
);
// Fixture is test-only; never seeded into the production conversation.
const messages = [
  {
    id: 'u1',
    role: 'user',
    content: '첫 질문\n둘째 줄',
    createdAt: '2026-11-13T00:00:00Z',
  },
  {
    id: 'a1',
    role: 'assistant',
    content: '테스트 전용 응답',
    createdAt: '2026-11-13T00:00:01Z',
  },
];
const render = () =>
  renderToStaticMarkup(React.createElement(ChatMessageList, { messages }));
assert(render().includes('chat-message-user'));
assert(render().includes('chat-message-assistant'));
assert(render().includes('첫 질문\n둘째 줄'));
assert(render().includes('테스트 전용 응답'));
messages[1].content += ' — 갱신된 텍스트';
assert(
  render().includes('갱신된 텍스트'),
  'Content updates under the same id are rendered',
);
assert.equal(messages[1].id, 'a1');
console.log(
  'PASS user/assistant fixture, multiline content and same-id content updates with no transport',
);
