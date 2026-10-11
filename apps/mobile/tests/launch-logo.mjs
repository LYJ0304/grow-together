import assert from 'node:assert/strict';

// Run against an exported web build and Chrome with remote debugging enabled.
const [siteUrl = 'http://localhost:8096', chromeUrl = 'http://localhost:9226'] =
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

try {
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 393,
    height: 852,
    deviceScaleFactor: 1,
    mobile: true,
  });
  const media = (value) =>
    call('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value }],
    });
  await media('no-preference');
  const { identifier } = await call('Page.addScriptToEvaluateOnNewDocument', {
    source: `
    window.logoFrames = [];
    function sample() {
      const logo = document.querySelector('.launch-logo');
      const title = document.querySelector('[data-testid="launch-title"]');
      if (logo && title) {
        const rect = logo.getBoundingClientRect();
        window.logoFrames.push({ time: performance.now(), state: logo.dataset.drawing,
          opacity: Number(getComputedStyle(title).opacity),
          offsets: [...logo.querySelectorAll('path')].map(p => Number.parseFloat(getComputedStyle(p).strokeDashoffset)),
          lengths: [...logo.querySelectorAll('path')].map(p => p.getTotalLength()),
          mask: getComputedStyle(logo.querySelector('.launch-logo-paint')).maskImage,
          rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height}
        });
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  `,
  });
  await call('Page.navigate', { url: siteUrl });
  await waitFor(
    'location.pathname === "/welcome" && !document.querySelector("[data-testid=launch-transition]")',
  );
  const frames = await evaluate('window.logoFrames');
  const drawing = frames.filter((f) => f.state === 'running');
  const done = frames.find((f) => f.state === 'done');
  assert(drawing.length > 20, 'Drawing must have intermediate frames');
  assert(done, 'The complete logo must paint before navigating');
  const elapsed = done.time - drawing[0].time;
  assert(elapsed >= 1800 && elapsed <= 2200, `Drawing duration: ${elapsed}ms`);
  for (let i = 0; i < 3; i++) {
    assert(
      drawing.some((f) => f.offsets[i] > 1 && f.offsets[i] < f.lengths[i] - 1),
      `Guide ${i} must draw`,
    );
    assert(
      drawing.every((f) => Math.abs(f.offsets[i]) <= f.lengths[i] + 1),
      'Dash lengths must match geometry',
    );
    if (i > 0)
      assert(
        drawing
          .filter((f) => f.offsets[i] < f.lengths[i] - 1)
          .every((f) => f.offsets[i - 1] < 1),
        'Guides must draw sequentially',
      );
  }
  assert(
    drawing
      .filter((f) => f.time - drawing[0].time < 260)
      .every((f) => f.opacity === 0),
    'Title must wait 300ms',
  );
  assert(
    drawing.some(
      (f) => f.time - drawing[0].time > 300 && f.opacity > 0 && f.opacity < 1,
    ),
    'Title must fade',
  );
  assert.equal(done.opacity, 1);
  assert.equal(done.mask, 'none', 'Final PNG must be unmasked');
  assert.equal(done.rect.width, 145);
  assert.equal(done.rect.height, 145);
  assert(
    drawing.every((f) => JSON.stringify(f.rect) === JSON.stringify(done.rect)),
    'Drawing must not shift layout',
  );
  console.log(
    'PASS sequential real-length drawing, 2s duration, delayed title fade, original PNG and fixed layout',
  );

  await evaluate('history.back()');
  await waitFor('location.pathname === "/app-name"');
  await evaluate('history.back()');
  await waitFor('location.pathname === "/"');
  assert.equal(
    await evaluate('document.querySelector(".launch-logo").dataset.drawing'),
    'done',
  );
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector(".launch-logo-paint")).maskImage',
    ),
    'none',
  );
  console.log('PASS no replay on back navigation');

  await media('reduce');
  await call('Page.navigate', { url: siteUrl });
  await waitFor('location.pathname === "/welcome"');
  const reduced = await evaluate('window.logoFrames');
  assert(reduced.length);
  assert(
    reduced.every((f) => f.mask === 'none' && f.opacity === 1),
    'Reduced motion must show static logo and title',
  );
  assert(
    !reduced.some((f) => f.state === 'running'),
    'Reduced motion must skip drawing',
  );
  console.log('PASS initial reduced-motion static state');

  await media('no-preference');
  await call('Page.navigate', { url: siteUrl });
  await waitFor(
    'document.querySelector(".launch-logo")?.dataset.drawing === "running"',
  );
  await media('reduce');
  await waitFor(
    'document.querySelector(".launch-logo")?.dataset.drawing === "done"',
  );
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector(".launch-logo-paint")).maskImage',
    ),
    'none',
  );
  await media('no-preference');
  assert.equal(
    await evaluate('document.querySelector(".launch-logo").dataset.drawing'),
    'done',
  );
  console.log('PASS live reduced-motion change completes without replay');
  await call('Page.removeScriptToEvaluateOnNewDocument', { identifier });

  const failure = await call('Page.addScriptToEvaluateOnNewDocument', {
    source: 'SVGGeometryElement.prototype.getTotalLength = () => 0;',
  });
  try {
    await call('Page.navigate', { url: siteUrl });
    await waitFor(
      'document.querySelector(".launch-logo")?.dataset.drawing === "done"',
    );
    assert.equal(
      await evaluate(
        'getComputedStyle(document.querySelector(".launch-logo-paint")).maskImage',
      ),
      'none',
    );
    await waitFor('location.pathname === "/welcome"');
    console.log(
      'PASS failed path measurement falls back to original PNG without blocking navigation',
    );
  } finally {
    await call('Page.removeScriptToEvaluateOnNewDocument', {
      identifier: failure.identifier,
    });
  }
} finally {
  socket.close();
}
