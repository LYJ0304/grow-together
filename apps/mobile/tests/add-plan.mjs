import assert from 'node:assert/strict';

// Run against an exported web build and Chrome with remote debugging enabled.
const [siteUrl = 'http://localhost:8094', chromeUrl = 'http://localhost:9234'] =
  process.argv.slice(2);
const pages = await (await fetch(`${chromeUrl}/json/list`)).json();
const socket = new WebSocket(
  pages.find((page) => page.type === 'page').webSocketDebuggerUrl,
);
await new Promise((resolve) =>
  socket.addEventListener('open', resolve, { once: true }),
);
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(JSON.stringify(message.error)));
  else request.resolve(message.result);
});

function call(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await call('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function waitFor(expression) {
  await evaluate(`new Promise((resolve, reject) => {
    const deadline = Date.now() + 10000;
    const timer = setInterval(() => {
      if (${expression}) { clearInterval(timer); resolve(true); }
      else if (Date.now() > deadline) { clearInterval(timer); reject(new Error('Screen did not settle')); }
    }, 25);
  })`);
}

async function click(label) {
  await evaluate(
    `[...document.querySelectorAll('[role="button"]')].find(node => node.getBoundingClientRect().width > 0 && (node.getAttribute('aria-label') === ${JSON.stringify(label)} || node.textContent.trim() === ${JSON.stringify(label)})).click()`,
  );
}

async function fill(label, value) {
  await evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)});
    const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
}

const planField = `document.querySelector('[aria-label="계획명"]')`;
try {
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 320,
    height: 568,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call('Page.navigate', { url: `${siteUrl}/todo` });
  await waitFor(`document.body.innerText.includes('＋ 계획 추가')`);
  await waitFor(
    `Object.keys(document.querySelector('[role="button"]')).some(key => key.startsWith('__reactProps'))`,
  );
  await click('＋ 계획 추가');
  await waitFor(planField);
  const selectedDate = await evaluate(
    `document.querySelector('[aria-pressed="true"]').getAttribute('aria-label')`,
  );
  assert(
    await evaluate(
      `document.body.innerText.includes(${JSON.stringify(selectedDate.split(' ').slice(0, 2).join(' '))})`,
    ),
  );
  await click('추가하기');
  await waitFor(`document.body.innerText.includes('계획명을 입력해 주세요.')`);
  await fill('계획명', '  공원 산책  ');
  for (const invalid of ['24:00', '12:60', '9:30']) {
    await fill('계획 시간', invalid);
    await click('추가하기');
    await waitFor(
      `document.body.innerText.includes('시간을 09:30처럼 입력해 주세요.')`,
    );
    assert(await evaluate(`!!${planField}`));
  }
  await fill('계획 시간', '09:30');
  await fill('계획 메모', '유모차 챙기기');
  await click('추가하기');
  await waitFor(`!${planField}`);
  assert(
    await evaluate(
      `document.body.innerText.includes('공원 산책') && document.body.innerText.includes('유모차 챙기기')`,
    ),
  );
  const titles = await evaluate(
    `[...document.querySelectorAll('[role="button"][aria-label]')].map(node => node.getAttribute('aria-label')).filter(label => /^\\d{2}:\\d{2} /.test(label))`,
  );
  assert(
    titles.indexOf('09:00 놀이 & 탐색') < titles.indexOf('09:30 공원 산책'),
  );
  assert(
    titles.indexOf('09:30 공원 산책') <
      titles.indexOf('10:00 낮잠 (1~1.5시간)'),
  );
  await click('＋ 계획 추가');
  await waitFor(planField);
  assert.equal(await evaluate(`${planField}.value`), '');
  await fill('계획명', '취소한 계획');
  await click('취소');
  await waitFor(`!${planField}`);
  assert.equal(
    await evaluate(`document.body.innerText.includes('취소한 계획')`),
    false,
  );
  await click('＋ 계획 추가');
  await waitFor(planField);
  await click('계획 추가 닫기');
  await waitFor(`!${planField}`);
  const otherDate = await evaluate(
    `document.querySelector('[aria-pressed="false"]').getAttribute('aria-label')`,
  );
  await click(otherDate);
  assert.equal(
    await evaluate(`document.body.innerText.includes('공원 산책')`),
    false,
  );
  await click(selectedDate);
  assert(await evaluate(`document.body.innerText.includes('공원 산책')`));
  await click('＋ 계획 추가');
  await waitFor(planField);
  await fill('계획명', '같은 시간 계획');
  await fill('계획 시간', '09:30');
  await click('추가하기');
  await waitFor(`!${planField}`);
  assert(
    await evaluate(
      `document.body.innerText.includes('공원 산책') && document.body.innerText.includes('같은 시간 계획')`,
    ),
  );
  await click('＋ 계획 추가');
  await waitFor(planField);
  const layout = await evaluate(`(() => {
    const field = document.querySelector('[aria-label="계획명"]');
    const button = [...document.querySelectorAll('[role="button"]')].find(node => node.textContent.trim() === '추가하기');
    button.scrollIntoView();
    return { width: document.documentElement.scrollWidth, viewport: innerWidth, buttonBottom: button.getBoundingClientRect().bottom, height: innerHeight, fieldWidth: field.getBoundingClientRect().width };
  })()`);
  assert(layout.width <= layout.viewport, 'Form must fit a narrow viewport');
  assert(
    layout.buttonBottom <= layout.height,
    'Submit must be reachable by scrolling',
  );
  assert(layout.fieldWidth > 0);
  console.log(
    'PASS plan form opening, validation, adding, sorting, duplicate times, date isolation, cancellation, reset, and narrow layout',
  );
} finally {
  socket.close();
}
