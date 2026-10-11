import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright-core';

// Serve an Expo web export; optional browser/baseline paths are documented in scripts/README.md.
const [siteUrl = 'http://localhost:8156'] = process.argv.slice(2);
const drawing = JSON.parse(
  readFileSync(
    new URL(
      '../assets/images/launch-drawing-masks/drawing.json',
      import.meta.url,
    ),
  ),
);
const source = readFileSync(
  new URL('../assets/images/grow-together-logo.png', import.meta.url),
);
assert.equal(
  createHash('sha256').update(source).digest('hex'),
  drawing.sourceSha256,
);
assert.equal(drawing.size, 145);
assert.equal(drawing.durationMs, 2300);
assert.equal(drawing.strokes.length, 2);
let end = 0;
for (const [index, stroke] of drawing.strokes.entries()) {
  assert(stroke.length > 1000);
  assert(
    Math.abs(stroke.startMs - end - (index ? drawing.penLiftMs : 0)) < 0.001,
  );
  assert.equal(stroke.frames[0].arc, 0);
  assert.equal(stroke.frames.at(-1).arc, stroke.length);
  for (let i = 1; i < stroke.frames.length; i++) {
    const a = stroke.frames[i - 1],
      b = stroke.frames[i];
    assert(b.timeMs > a.timeMs && b.arc > a.arc);
    assert(b.timeMs - a.timeMs <= 1000 / drawing.fps + 0.001);
    assert(
      Math.abs(
        (b.arc - a.arc) / (b.timeMs - a.timeMs) -
          stroke.length / stroke.durationMs,
      ) < 0.002,
    );
    assert(
      Math.hypot(b.head[0] - a.head[0], b.head[1] - a.head[1]) <=
        ((b.arc - a.arc) * 145) / 1024 + 0.01,
    );
  }
  end = stroke.startMs + stroke.durationMs;
}
assert(Math.abs(end - drawing.durationMs) < 0.001);
assert(
  Math.abs(
    drawing.strokes[0].length / drawing.strokes[0].durationMs -
      drawing.strokes[1].length / drawing.strokes[1].durationMs,
  ) < 0.00001,
);
const artifacts = mkdtempSync(join(tmpdir(), 'grow-logo-verification-'));
const reports = [];
const configurations = [
  [
    'chrome-desktop',
    chromium,
    { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
  ],
  [
    'chrome-mobile-2x',
    chromium,
    {
      viewport: { width: 393, height: 852 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  ],
  [
    'chrome-mobile-3x',
    chromium,
    {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    },
  ],
];
if (process.env.WEBKIT_EXECUTABLE) {
  for (const scale of [2, 3])
    configurations.push([
      `webkit-mobile-${scale}x`,
      webkit,
      {
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: scale,
        isMobile: true,
        hasTouch: true,
      },
    ]);
} else
  console.log(
    'WebKit not configured; set WEBKIT_EXECUTABLE. Actual iPhone Safari needs a separate device check.',
  );
function stats(intervals) {
  assert(intervals.length > 10, 'Drawing must run, not silently fall back');
  const sorted = [...intervals].sort((a, b) => a - b);
  return {
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    p95: sorted[Math.floor(sorted.length * 0.95)],
    max: sorted.at(-1),
    over33ms: sorted.filter((t) => t > 33.34).length,
    over50ms: sorted.filter((t) => t > 50).length,
  };
}
async function pacing(browser, options, url) {
  const page = await browser.newPage({
    ...options,
    reducedMotion: 'no-preference',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.logoPerf = {
      times: [],
      start: null,
      done: null,
      commits: [],
      styleWrites: 0,
    };
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      inject() {
        return 1;
      },
      onCommitFiberRoot() {
        window.logoPerf.commits.push(performance.now());
      },
      onCommitFiberUnmount() {},
    };
    window.logoResources = { created: 0, deleted: 0 };
    const getContext = HTMLCanvasElement.prototype.getContext;
    const contexts = new WeakSet();
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const gl = getContext.apply(this, args);
      if (args[0] === 'webgl' && gl && !contexts.has(gl)) {
        contexts.add(gl);
        const create = gl.createTexture.bind(gl),
          remove = gl.deleteTexture.bind(gl);
        gl.createTexture = () => {
          window.logoResources.created++;
          return create();
        };
        gl.deleteTexture = (texture) => {
          window.logoResources.deleted++;
          remove(texture);
        };
      }
      return gl;
    };
    let observed = false;
    function sample(t) {
      const logo = document.querySelector('.launch-logo');
      if (logo) {
        if (!observed) {
          observed = true;
          new MutationObserver((records) => {
            window.logoPerf.styleWrites += records.filter(
              (r) => r.attributeName === 'style',
            ).length;
          }).observe(logo, { attributes: true, subtree: true });
        }
        if (logo.dataset.drawing === 'running') {
          if (window.logoPerf.start === null) {
            window.logoPerf.start = Number(
              logo.querySelector('canvas')?.dataset.startTime ??
                logo.querySelector('path')?.getAnimations()[0]?.startTime ??
                t,
            );
            window.logoPerf.times.push(window.logoPerf.start);
          }
          if (t <= window.logoPerf.times.at(-1))
            return requestAnimationFrame(sample);
          window.logoPerf.times.push(t);
        }
        if (logo.dataset.drawing === 'done') window.logoPerf.done ??= t;
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await page.goto(url);
  await page.waitForURL('**/welcome');
  const raw = await page.evaluate(() => window.logoPerf);
  const resources = await page.evaluate(() => window.logoResources);
  if (url === siteUrl)
    assert.equal(resources.created, 2, 'Both GPU masks must be uploaded');
  assert.equal(
    resources.deleted,
    resources.created,
    'GPU input textures must be released on completion',
  );
  const intervals = raw.times
    .slice(1)
    .map((t, i) => ({ dt: t - raw.times[i], time: raw.times[i] - raw.start }));
  assert.deepEqual(errors, []);
  const commits = raw.commits.filter(
    (t) => t > raw.start + 100 && t < raw.done - 50,
  ).length;
  assert.equal(commits, 0, 'No React updates during drawing');
  assert(raw.styleWrites <= 12, 'No per-frame DOM style writes');
  const report = {
    ...stats(intervals.map((x) => x.dt)),
    first500: stats(intervals.filter((x) => x.time < 500).map((x) => x.dt)),
    styleWrites: raw.styleWrites,
    commitsDuringDrawing: commits,
  };
  await page.close();
  return report;
}
// Freeze after GPU preparation. Actual shaders/composition receive deterministic rAF times.
function controlledClock() {
  const nativeRAF = requestAnimationFrame.bind(window),
    nativeCancel = cancelAnimationFrame.bind(window);
  const callbacks = new Map();
  let id = 0;
  window.logoClock = {
    frozen: false,
    base: 0,
    step(time) {
      const current = [...callbacks.values()];
      callbacks.clear();
      current.forEach((callback) => callback(this.base + time));
    },
    release() {
      this.frozen = false;
      callbacks.forEach((callback) => nativeRAF(callback));
      callbacks.clear();
    },
  };
  window.requestAnimationFrame = (callback) => {
    if (!window.logoClock.frozen) return nativeRAF(callback);
    callbacks.set(--id, callback);
    return id;
  };
  window.cancelAnimationFrame = (value) =>
    value < 0 ? callbacks.delete(value) : nativeCancel(value);
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...args) {
    const context = getContext.apply(this, args);
    if (
      args[0] === 'webgl' &&
      context &&
      this.className === 'launch-logo-canvas'
    ) {
      const draw = context.drawArrays.bind(context);
      context.drawArrays = (...params) => {
        draw(...params);
        if (!window.logoClock.frozen) {
          window.logoClock.frozen = true;
          window.logoClock.base = performance.now();
        }
      };
    }
    return context;
  };
}
async function compareFrames(page, frames, clip) {
  return page.evaluate(
    async ({ frames, clip, drawing }) => {
      const decoded = [];
      for (const frame of frames) {
        const image = new Image();
        image.src = `data:image/png;base64,${frame.png}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        decoded.push(context.getImageData(0, 0, canvas.width, canvas.height));
      }
      let blankMax = 0;
      for (let i = 0; i < decoded[0].data.length; i++) {
        if (i % 4 !== 3)
          blankMax = Math.max(
            blankMax,
            Math.abs(decoded[0].data[i] - [250, 249, 249][i % 4]),
          );
      }
      if (blankMax > 2)
        throw new Error(`Initial frame exposed logo pixels: ${blankMax}`);
      const differences = [];
      for (let i = 1; i < decoded.length; i++) {
        const before = decoded[i - 1],
          after = decoded[i];
        const from = frames[i - 1].time,
          to = frames[i].time;
        const heads = drawing.strokes.flatMap((stroke) =>
          stroke.frames.filter(
            (f) =>
              stroke.startMs + f.timeMs >= from - 1000 / drawing.fps &&
              stroke.startMs + f.timeMs <= to + 1000 / drawing.fps,
          ),
        );
        let changed = 0,
          rewound = 0,
          far = 0,
          max = 0;
        for (let p = 0; p < after.width * after.height; p++) {
          const offset = p * 4;
          const delta = Math.max(
            ...[0, 1, 2].map((c) =>
              Math.abs(after.data[offset + c] - before.data[offset + c]),
            ),
          );
          max = Math.max(max, delta);
          if (
            [0, 1, 2].some(
              (c) => after.data[offset + c] > before.data[offset + c] + 3,
            )
          )
            rewound++;
          if (delta > 12) {
            changed++;
            const x = (((p % after.width) + 0.5) * clip.width) / after.width,
              y =
                ((Math.floor(p / after.width) + 0.5) * clip.height) /
                after.height;
            if (
              !heads.some(
                (h) =>
                  Math.hypot(x - h.head[0], y - h.head[1]) <= h.radius + 2.5,
              )
            )
              far++;
          }
        }
        differences.push({ from, to, changed, rewound, far, max });
      }
      return differences;
    },
    { frames, clip, drawing },
  );
}
async function visual(browser, options, name) {
  const page = await browser.newPage({
    ...options,
    reducedMotion: 'no-preference',
  });
  await page.addInitScript(controlledClock);
  await page.goto(siteUrl);
  await page.waitForFunction(() => window.logoClock.frozen);
  await page.evaluate(() => {
    window.logoClock.step(0);
    window.logoClock.step(0);
  });
  await page.waitForSelector('.launch-logo[data-drawing="running"]');
  const logo = page.locator('.launch-logo'),
    clip = await logo.boundingBox();
  assert.equal(clip.width, 145);
  assert.equal(clip.height, 145);
  assert.equal(await logo.locator('svg').count(), 0);
  const pngSource = await page
    .locator('.launch-logo-original')
    .getAttribute('src');
  const frames = [];
  const times = [
    0,
    8,
    16.667,
    50,
    150,
    300,
    500,
    750,
    930,
    drawing.strokes[0].durationMs,
    980,
    drawing.strokes[1].startMs,
    1010,
    1050,
    1300,
    1800,
    2070,
    2200,
    2283.333,
    2300,
    2316.667,
  ];
  for (const time of times) {
    await page.evaluate((time) => window.logoClock.step(time), time);
    const png = await page.screenshot({ clip });
    writeFileSync(join(artifacts, `${name}-${time.toFixed(3)}.png`), png);
    frames.push({ time, png: png.toString('base64') });
  }
  assert.equal(await logo.getAttribute('data-drawing'), 'done');
  const differences = await compareFrames(page, frames, clip);
  for (const d of differences) {
    assert.equal(d.rewound, 0, `Drawing erased pixels: ${JSON.stringify(d)}`);
    assert.equal(
      d.far,
      0,
      `Pixels appeared away from the actual pen route: ${JSON.stringify(d)}`,
    );
    if (
      (d.from >= drawing.strokes[0].durationMs &&
        d.to <= drawing.strokes[1].startMs) ||
      d.from >= 2300
    )
      assert(
        d.max <= 1,
        `Pen lift/completion changed the image: ${JSON.stringify(d)}`,
      );
    else
      assert(
        d.changed > 0,
        `Unexpected stationary drawing: ${JSON.stringify(d)}`,
      );
  }
  await page.evaluate(() => window.logoClock.release());
  await page.waitForURL('**/welcome');
  await page.evaluate(
    async ({ src, clip }) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      Object.assign(image.style, {
        position: 'fixed',
        left: `${clip.x}px`,
        top: `${clip.y}px`,
        width: '145px',
        height: '145px',
        background: '#FAF9F9',
        zIndex: '2147483647',
      });
      document.body.appendChild(image);
    },
    { src: pngSource, clip },
  );
  const reference = await page.screenshot({ clip });
  writeFileSync(join(artifacts, `${name}-reference.png`), reference);
  const fidelity = await page.evaluate(
    async ([a, b]) => {
      const pixels = [];
      for (const src of [a, b]) {
        const image = new Image();
        image.src = `data:image/png;base64,${src}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        pixels.push(
          context.getImageData(0, 0, canvas.width, canvas.height).data,
        );
      }
      let max = 0,
        sum = 0;
      for (let i = 0; i < pixels[0].length; i++) {
        const delta = Math.abs(pixels[0][i] - pixels[1][i]);
        max = Math.max(max, delta);
        sum += delta;
      }
      return { max, mean: sum / pixels[0].length };
    },
    [frames.at(-1).png, reference.toString('base64')],
  );
  assert(
    fidelity.max <= 16 && fidelity.mean < 0.1,
    `Final frame differs from native PNG: ${JSON.stringify(fidelity)}`,
  );
  await page.close();
  return { differences, fidelity };
}
async function behavior(browser) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(siteUrl);
  await page.waitForURL('**/welcome');
  await page.goBack();
  await page.goBack();
  await page.waitForFunction(() => location.pathname === '/');
  await page.waitForSelector('.launch-logo[data-drawing="done"]');
  assert.equal(
    await page.locator('.launch-logo').getAttribute('data-rendering'),
    'original',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(siteUrl);
  await page.waitForSelector('.launch-logo[data-drawing="running"]');
  await page.mouse.click(50, 50);
  await page.waitForURL('**/welcome');
  await page.goBack();
  await page.goBack();
  await page.waitForFunction(() => location.pathname === '/');
  await page.waitForSelector('.launch-logo[data-drawing="done"]');
  assert.equal(
    await page.locator('.launch-logo').getAttribute('data-rendering'),
    'original',
  );
  await page.goto(siteUrl);
  await page.waitForSelector('.launch-logo[data-drawing="running"]');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForURL('**/welcome');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(siteUrl);
  await page.waitForSelector('.launch-logo[data-drawing="running"]');
  const lost = await page.evaluate(() => {
    const context = document
      .querySelector('.launch-logo-canvas')
      .getContext('webgl');
    const extension = context.getExtension('WEBGL_lose_context');
    extension?.loseContext();
    return Boolean(extension);
  });
  if (lost)
    await page.waitForSelector('.launch-logo[data-rendering="original"]');
  await page.waitForURL('**/welcome');
  await page.close();
  for (const failure of ['webgl', 'decode']) {
    const fallback = await browser.newPage();
    await fallback.addInitScript((failure) => {
      if (failure === 'decode')
        HTMLImageElement.prototype.decode = () =>
          Promise.reject(new Error('decode failed'));
      else {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (...args) {
          return args[0] === 'webgl' ? null : getContext.apply(this, args);
        };
      }
    }, failure);
    await fallback.goto(siteUrl);
    await fallback.waitForSelector('.launch-logo[data-rendering="original"]');
    await fallback.waitForURL('**/welcome');
    await fallback.close();
  }
}
const selected = configurations.filter(
  ([name]) =>
    !process.env.LOGO_BROWSER || name.startsWith(process.env.LOGO_BROWSER),
);
assert(selected.length > 0, 'Requested browser configuration is unavailable');
console.log(`Artifacts: ${artifacts}`);
for (const [name, type, options] of selected) {
  const browser = await type.launch(
    type === chromium
      ? {
          executablePath:
            process.env.CHROME_EXECUTABLE || '/usr/bin/google-chrome',
          args: ['--no-sandbox'],
        }
      : { executablePath: process.env.WEBKIT_EXECUTABLE },
  );
  try {
    const report = {
      name,
      pacing: await pacing(browser, options, siteUrl),
      visual: await visual(browser, options, name),
    };
    if (process.env.LOGO_BASELINE_URL)
      report.baseline = await pacing(
        browser,
        options,
        process.env.LOGO_BASELINE_URL,
      );
    if (name === 'chrome-desktop' || name === 'webkit-mobile-2x')
      await behavior(browser);
    reports.push(report);
    writeFileSync(
      join(artifacts, 'report.json'),
      JSON.stringify(reports, null, 2),
    );
    console.log(
      JSON.stringify({
        name,
        pacing: report.pacing,
        fidelity: report.visual.fidelity,
      }),
    );
  } finally {
    await browser.close();
  }
}
console.log(
  `Geometry, rendered-head continuity, pen lift, completion, PNG fidelity, accessibility, skip, history, and fallback passed. Artifacts: ${artifacts}`,
);
