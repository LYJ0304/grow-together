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
    function sample(timestamp) {
      const logo = document.querySelector('.launch-logo');
      const title = document.querySelector('[data-testid="launch-title"]');
      if (logo && title) {
        const rect = logo.getBoundingClientRect();
        window.logoFrames.push({ time: timestamp, state: logo.dataset.drawing,
          opacity: Number(getComputedStyle(title).opacity),
          offsets: [...logo.querySelectorAll('path')].map(p => Number.parseFloat(getComputedStyle(p).strokeDashoffset)),
          lengths: [...logo.querySelectorAll('path')].map(p => p.getTotalLength()),
          caps: [...logo.querySelectorAll('path')].map(p => getComputedStyle(p).strokeLinecap),
          joins: [...logo.querySelectorAll('path')].map(p => getComputedStyle(p).strokeLinejoin),
          visible: [...logo.querySelectorAll('path')].map(p => Number(getComputedStyle(p).opacity)),
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
  assert(elapsed >= 2000 && elapsed <= 2500, `Drawing duration: ${elapsed}ms`);
  for (let i = 0; i < drawing[0].lengths.length; i++) {
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
    assert(
      drawing.every((f) => f.caps[i] === 'round' && f.joins[i] === 'round'),
    );
    assert(
      drawing
        .filter((f) => f.offsets[i] === f.lengths[i])
        .every((f) => f.visible[i] === 0),
      'Unstarted round caps must not reveal dots',
    );
  }
  const distance = (f) =>
    f.lengths.reduce((sum, length, i) => sum + length - f.offsets[i], 0);
  const total = drawing[0].lengths.reduce((sum, length) => sum + length, 0);
  const linearSpeed = total / (2300 * 0.9975);
  for (let i = 1; i < drawing.length; i++) {
    assert(distance(drawing[i]) >= distance(drawing[i - 1]), 'No rewind');
  }
  // Sample over several frames to tolerate the observation callback's frame order.
  for (let i = 4; i < drawing.length; i++) {
    const before = drawing[i - 4];
    const after = drawing[i];
    if (distance(before) < total * 0.02 || distance(after) > total * 0.94)
      continue;
    const speed =
      (distance(after) - distance(before)) / (after.time - before.time);
    assert(
      Math.abs(speed / linearSpeed - 1) < 0.15,
      `Constant speed including Path boundaries: ${speed / linearSpeed}`,
    );
  }
  const tailStart = drawing.find((f) => distance(f) >= total * 0.96);
  const tailEnd = drawing.find((f) => distance(f) >= total * 0.995);
  assert(tailStart && tailEnd, 'Final slowdown must have intermediate frames');
  const tailSpeed =
    (distance(tailEnd) - distance(tailStart)) / (tailEnd.time - tailStart.time);
  assert(tailSpeed < linearSpeed && tailSpeed > linearSpeed * 0.85);
  assert(
    done.offsets.every((offset) => offset === 0),
    'Exact final offsets',
  );
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
    `PASS continuous real-length drawing, ${Math.round(elapsed)}ms duration, subtle final slowdown, round caps, original PNG and fixed layout`,
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

  await evaluate(`const logo = document.querySelector('.launch-logo');
    logo.dataset.drawing = 'running';
    logo.querySelectorAll('path').forEach(path => {
      path.style.strokeDasharray = 'none';
      path.style.strokeDashoffset = '0';
      path.style.opacity = '1';
    });`);
  const clip = { ...done.rect, scale: 1 };
  const masked = await call('Page.captureScreenshot', { clip });
  await evaluate(
    `document.querySelector('.launch-logo').dataset.drawing = 'done'`,
  );
  const original = await call('Page.captureScreenshot', { clip });
  const maxPixelDifference = await evaluate(`(async () => {
    const pixels = async (png) => {
      const image = new Image(); image.src = 'data:image/png;base64,' + png;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, image.width, image.height).data;
    };
    const a = await pixels(${JSON.stringify(masked.data)});
    const b = await pixels(${JSON.stringify(original.data)});
    return a.reduce((max, value, i) => Math.max(max, Math.abs(value - b[i])), 0);
  })()`);
  assert(
    maxPixelDifference <= 16,
    `Completed mask must cover the PNG (antialias tolerance): ${maxPixelDifference}`,
  );
  console.log(
    'PASS completed mask covers original PNG without missing strokes',
  );

  await call('Page.navigate', { url: siteUrl });
  await waitFor(`(() => {
    const frame = window.logoFrames.at(-1);
    return frame?.state === 'running' &&
      frame.lengths[0] - frame.offsets[0] > frame.lengths[0] * 0.85;
  })()`);
  // Deliberately stall across a Path boundary to exercise timestamp-based catch-up.
  await evaluate(`new Promise(resolve => {
    const end = performance.now() + 300;
    while (performance.now() < end) {}
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  })`);
  await waitFor('location.pathname === "/welcome"');
  const stalled = (await evaluate('window.logoFrames')).filter(
    (f) => f.state === 'running',
  );
  const gap = stalled.findIndex(
    (f, i) => i > 0 && f.time - stalled[i - 1].time > 200,
  );
  assert(gap > 0 && gap + 2 < stalled.length, 'Stall must be observed');
  const beforeGap = stalled[gap - 1];
  const afterGap = stalled[gap + 2];
  assert(beforeGap.offsets[0] > 0 && afterGap.offsets[0] === 0);
  assert(afterGap.offsets[1] < afterGap.lengths[1], 'Next Path must catch up');
  const catchupSpeed =
    (distance(afterGap) - distance(beforeGap)) /
    (afterGap.time - beforeGap.time);
  assert(
    Math.abs(catchupSpeed / linearSpeed - 1) < 0.15,
    'Lost frames must not reset speed or add a Path delay',
  );
  console.log(
    'PASS timestamp catch-up across a Path boundary after a 300ms stall',
  );

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

  for (const measurement of ['0', 'Number.NaN']) {
    const failure = await call('Page.addScriptToEvaluateOnNewDocument', {
      source: `SVGGeometryElement.prototype.getTotalLength = () => ${measurement};`,
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
        `PASS path measurement ${measurement} falls back to original PNG without blocking navigation`,
      );
    } finally {
      await call('Page.removeScriptToEvaluateOnNewDocument', {
        identifier: failure.identifier,
      });
    }
  }
} finally {
  socket.close();
}
