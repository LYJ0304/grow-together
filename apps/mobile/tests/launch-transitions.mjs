import assert from 'node:assert/strict';

// Run against an exported web build and Chrome with remote debugging enabled.
const [siteUrl = 'http://localhost:8093', chromeUrl = 'http://localhost:9223'] =
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

async function testTransition(label, destination) {
  const { trace, pushes } = await evaluate(`new Promise(resolve => {
    const trace = [];
    let pushes = 0;
    const originalPush = history.pushState;
    history.pushState = function(...args) {
      pushes++;
      return originalPush.apply(this, args);
    };
    const start = performance.now();
    const button = document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)});
    function sample() {
      const overlay = document.querySelector('[data-testid="launch-transition-title"]');
      const heading = [...document.querySelectorAll('[role="heading"]')].find(node => node.getBoundingClientRect().width > 0);
      trace.push({
        time: performance.now() - start,
        route: location.pathname,
        y: overlay ? overlay.getBoundingClientRect().top : null,
        titleY: heading?.getBoundingClientRect().top,
        opacity: heading ? Number(getComputedStyle(heading.parentElement.parentElement).opacity) : 1,
      });
      if (performance.now() - start < 850) requestAnimationFrame(sample);
      else { history.pushState = originalPush; resolve({trace, pushes}); }
    }
    button.click();
    button.click();
    requestAnimationFrame(sample);
  })`);
  assert.equal(await evaluate('location.pathname'), destination);
  assert.equal(pushes, 1, 'Rapid taps must navigate only once');
  const moving = trace.filter((frame) => frame.y !== null);
  assert(moving.length >= 5, 'Title must animate across multiple frames');
  const from = moving[0].y;
  const to = trace.at(-1).titleY;
  assert(
    Math.abs(to - from) > 10,
    'Title must travel between screen positions',
  );
  assert(
    moving.some(
      (frame) =>
        frame.y > Math.min(from, to) + 2 && frame.y < Math.max(from, to) - 2,
    ),
    'Title must pass through intermediate positions',
  );
  const direction = Math.sign(to - from);
  for (let index = 1; index < moving.length; index++) {
    assert(
      (moving[index].y - moving[index - 1].y) * direction >= -1,
      'Motion must not jump backwards',
    );
  }
  assert(
    Math.abs(moving.at(-1).y - to) < 4,
    'Title must hand off without a position jump',
  );
  assert(
    trace.some(
      (frame) =>
        frame.route === destination && frame.opacity > 0 && frame.opacity < 1,
    ),
    'Destination must fade in',
  );
  assert.equal(
    trace.at(-1).y,
    null,
    'Overlay must be removed after completion',
  );
  console.log(
    `PASS ${destination}: continuous title motion, fade, handoff, rapid taps`,
  );
}

try {
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 393,
    height: 852,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });
  await call('Page.navigate', { url: siteUrl });
  await waitFor(
    'document.querySelector("[aria-label=\\"앱 이름 화면으로 이동\\"]") && document.fonts.check("35px Jua")',
  );
  await evaluate('new Promise(resolve => setTimeout(resolve, 700))');
  await testTransition('앱 이름 화면으로 이동', '/app-name');
  await testTransition('로그인 및 가입 선택 화면으로 이동', '/welcome');

  await evaluate('history.back()');
  await waitFor('location.pathname === "/app-name"');
  await evaluate('history.back()');
  await waitFor('location.pathname === "/"');
  await evaluate(
    `document.querySelector('[aria-label="앱 이름 화면으로 이동"]').click()`,
  );
  await waitFor(
    'location.pathname === "/app-name" && document.querySelector("[data-testid=launch-transition]")',
  );
  await evaluate('history.back()');
  await waitFor(
    'location.pathname === "/" && !document.querySelector("[data-testid=launch-transition]")',
  );
  console.log('PASS back navigation cancels an in-flight transition');

  await testTransition('앱 이름 화면으로 이동', '/app-name');
  await evaluate(
    `document.querySelector('[aria-label="로그인 및 가입 선택 화면으로 이동"]').click()`,
  );
  await waitFor(
    'location.pathname === "/welcome" && document.querySelector("[data-testid=launch-transition]")',
  );
  await call('Emulation.setDeviceMetricsOverride', {
    width: 393,
    height: 640,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await waitFor('!document.querySelector("[data-testid=launch-transition]")');
  assert.equal(await evaluate('location.pathname'), '/welcome');
  console.log('PASS viewport resizing settles an in-flight transition');
  await evaluate('history.back()');
  await waitFor('location.pathname === "/app-name"');
  await evaluate('history.back()');
  await waitFor('location.pathname === "/"');

  await call('Emulation.setDeviceMetricsOverride', {
    width: 320,
    height: 568,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call('Emulation.setSafeAreaInsetsOverride', {
    insets: { top: 47, bottom: 34, left: 0, right: 0 },
  });
  await call('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await evaluate('new Promise(resolve => setTimeout(resolve, 200))');
  for (const [label, destination] of [
    ['앱 이름 화면으로 이동', '/app-name'],
    ['로그인 및 가입 선택 화면으로 이동', '/welcome'],
  ]) {
    await evaluate(
      `document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)}).click()`,
    );
    await waitFor(`location.pathname === ${JSON.stringify(destination)}`);
    assert.equal(
      await evaluate(
        '!!document.querySelector("[data-testid=launch-transition]")',
      ),
      false,
    );
  }
  assert.equal(
    await evaluate(
      `document.querySelectorAll('[role="button"]:not([aria-label])').length`,
    ),
    2,
  );
  console.log(
    'PASS reduced motion skips both animations on a small safe-area viewport',
  );
} finally {
  socket.close();
}
