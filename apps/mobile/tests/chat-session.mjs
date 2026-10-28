import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const code = ts.transpileModule(
  readFileSync(new URL('../src/lib/chat-session.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const module = { exports: {} };
vm.runInNewContext(code, {
  module,
  exports: module.exports,
  require,
  AbortController,
  Headers,
  setTimeout,
  clearTimeout,
});
const { ChatSession } = module.exports;
let nextId = 0;
const ids = () => `id-${++nextId}`;
const frame = (event) =>
  new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
function setup(handler) {
  let creates = 0;
  const auth = {
    request: async () => {
      creates++;
      return { threadId: 'thread-1' };
    },
    stream: async (_path, init) => handler(init),
  };
  return { chat: new ChatSession(auth, fetch, ids), creates: () => creates };
}
function stream(init, extra) {
  const { threadId, runId } = JSON.parse(init.body);
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          frame({
            type: 'RUN_STARTED',
            threadId,
            runId,
            protocolVersion: '1.0',
          }),
        );
        controller.enqueue(
          frame({
            type: 'TEXT_MESSAGE_START',
            messageId: 'reply',
            role: 'assistant',
          }),
        );
        extra(controller, { threadId, runId });
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}
{
  let finish;
  let requests = 0;
  const s = setup((init) => {
    requests++;
    return stream(init, (c, ids) => {
      c.enqueue(
        frame({
          type: 'TEXT_MESSAGE_CONTENT',
          messageId: 'reply',
          delta: '안녕',
        }),
      );
      finish = () => {
        c.enqueue(
          frame({
            type: 'TEXT_MESSAGE_CONTENT',
            messageId: 'reply',
            delta: '하세요',
          }),
        );
        c.enqueue(frame({ type: 'TEXT_MESSAGE_END', messageId: 'reply' }));
        c.enqueue(frame({ type: 'RUN_FINISHED', ...ids }));
        c.close();
      };
    });
  });
  const pending = s.chat.send('질문');
  for (let i = 0; i < 20 && s.chat.getSnapshot().status !== 'streaming'; i++)
    await new Promise((r) => setImmediate(r));
  assert.equal(s.chat.getSnapshot().messages.at(-1).content, '안녕');
  await s.chat.send('중복');
  assert.equal(requests, 1);
  finish();
  await pending;
  assert.equal(s.chat.getSnapshot().status, 'complete');
  assert.equal(s.chat.getSnapshot().messages.at(-1).content, '안녕하세요');
}
for (const failure of ['error', 'truncated']) {
  const runIds = [];
  const s = setup((init) => {
    runIds.push(JSON.parse(init.body).runId);
    return stream(init, (c) => {
      c.enqueue(
        frame({
          type: 'TEXT_MESSAGE_CONTENT',
          messageId: 'reply',
          delta: '부분 응답',
        }),
      );
      if (failure === 'error')
        c.enqueue(
          frame({
            type: 'RUN_ERROR',
            message: 'provider error',
            code: 'MODEL_ERROR',
          }),
        );
      c.close();
    });
  });
  await s.chat.send('질문');
  assert.equal(s.chat.getSnapshot().status, 'error');
  assert.equal(s.chat.getSnapshot().messages.at(-1).content, '부분 응답');
  await s.chat.retry();
  assert.notEqual(runIds[0], runIds[1]);
  assert.equal(
    s.chat.getSnapshot().messages.filter((m) => m.role === 'user').length,
    1,
  );
}
{
  let cancel;
  const s = setup((init) =>
    stream(init, (c) => {
      c.enqueue(
        frame({
          type: 'TEXT_MESSAGE_CONTENT',
          messageId: 'reply',
          delta: '보존',
        }),
      );
      cancel = () => c.close();
      init.signal.addEventListener('abort', cancel, { once: true });
    }),
  );
  const pending = s.chat.send('질문');
  for (let i = 0; i < 20 && !cancel; i++)
    await new Promise((r) => setImmediate(r));
  s.chat.stop();
  await pending;
  assert.equal(s.chat.getSnapshot().status, 'stopped');
  assert.equal(s.chat.getSnapshot().messages.at(-1).content, '보존');
  s.chat.clear();
  assert.equal(s.chat.getSnapshot().messages.length, 0);
  assert.equal(s.chat.getSnapshot().status, 'idle');
}
{
  let release;
  const auth = {
    request: () =>
      new Promise((r) => {
        release = r;
      }),
    stream: () => {
      throw Error('must not run after logout');
    },
  };
  const chat = new ChatSession(auth, fetch, ids);
  const pending = chat.send('비밀');
  chat.clear();
  release({ threadId: 'thread-1' });
  await pending;
  assert.equal(chat.getSnapshot().messages.length, 0);
}
console.log(
  'PASS incremental text, duplicate suppression, RUN_ERROR/truncation, retry IDs, partial preservation, cancellation and late logout results',
);
// A transport that ignores abort must not keep the UI locked after the total timeout.
{
  let expire;
  const isolated = { exports: {} };
  vm.runInNewContext(code, {
    module: isolated,
    exports: isolated.exports,
    require,
    AbortController,
    Headers,
    setTimeout: (callback) => {
      expire = callback;
      return 1;
    },
    clearTimeout: () => {},
  });
  let requests = 0;
  const auth = {
    request: async () => ({ threadId: 'thread-1' }),
    stream: () => {
      requests++;
      return new Promise(() => {});
    },
  };
  const chat = new isolated.exports.ChatSession(auth, fetch, ids);
  void chat.send('첫 질문');
  await new Promise((r) => setImmediate(r));
  expire();
  assert.equal(chat.getSnapshot().status, 'error');
  void chat.retry();
  await new Promise((r) => setImmediate(r));
  assert.equal(
    requests,
    2,
    'Timeout releases the active run so manual retry can start',
  );
  chat.clear();
}
// SSE bytes may split a UTF-8 code point or a JSON frame at any boundary.
{
  const s = setup((init) => {
    const { threadId, runId } = JSON.parse(init.body);
    const events = [
      { type: 'RUN_STARTED', threadId, runId },
      { type: 'TEXT_MESSAGE_START', messageId: 'utf8', role: 'assistant' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'utf8', delta: '한글🙂' },
      { type: 'TEXT_MESSAGE_END', messageId: 'utf8' },
      { type: 'RUN_FINISHED', threadId, runId },
    ];
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(': keep-alive\n\n'));
          for (const event of events)
            for (const byte of frame(event))
              controller.enqueue(new Uint8Array([byte]));
          controller.close();
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } },
    );
  });
  await s.chat.send('바이트 경계');
  assert.equal(s.chat.getSnapshot().status, 'complete');
  assert.equal(s.chat.getSnapshot().messages.at(-1).content, '한글🙂');
}
console.log('PASS silent transport timeout/retry and split UTF-8/SSE frames');
