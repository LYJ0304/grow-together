import { authenticatedSessionFixture } from './auth-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright-core';

// Run against an Expo web export served at MAIN_URL.
const url = process.env.MAIN_URL ?? 'http://localhost:8098';
const artifacts = process.env.ARTIFACT_DIR ?? '/tmp/grow-main-68';
const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
await mkdir(artifacts, { recursive: true });
const svg = await readFile(
  new URL('../assets/images/main/progress-ring.svg', import.meta.url),
  'utf8',
);
const [, arc, circumference] = svg.match(
  /stroke-dasharray="([\d.]+) ([\d.]+)"/,
);
assert.ok(Math.abs(Number(arc) / Number(circumference) - 0.7) < 1e-10);
assert.ok(Math.abs(Number(circumference) - 2 * Math.PI * 90) < 1e-10);
const browser = await engine.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 393, height: 852 },
  reducedMotion: 'no-preference',
});
await page.addInitScript(authenticatedSessionFixture);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const progress = page.getByRole('progressbar', { name: '오늘의 루틴' });
const character = page.getByTestId('routine-character');
async function open() {
  await page.goto(`${url}/main`);
  await page.getByTestId('main-screen').waitFor();
  await progress.waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    [...document.images].every(
      (image) => image.complete && image.naturalWidth > 0,
    ),
  );
}
async function samples() {
  return character.evaluate(
    (element) =>
      new Promise((resolve) => {
        const values = [];
        const start = performance.now();
        function sample() {
          values.push(
            new DOMMatrixReadOnly(getComputedStyle(element).transform).m42,
          );
          if (performance.now() - start < 5300) requestAnimationFrame(sample);
          else resolve(values);
        }
        requestAnimationFrame(sample);
      }),
  );
}
try {
  for (const width of [320, 375, 393, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await open();
    assert.equal(await progress.getAttribute('aria-valuenow'), '70');
    assert.match(await progress.innerText(), /70\s*%/);
    assert.equal(await progress.getAttribute('aria-valuemax'), '100');
    assert.equal(await progress.getAttribute('aria-valuetext'), '70퍼센트');
    const schedule = page.getByRole('heading', { name: '오늘의 일정' });
    const diary = page.getByRole('heading', { name: 'AI 일기' });
    const a = await schedule.boundingBox();
    const b = await diary.boundingBox();
    assert.ok(width < 360 ? b.y > a.y : Math.abs(a.y - b.y) < 1);
    for (const name of ['전체 보기 →', '만들러 가기']) {
      const button = page.getByRole('button', { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      const nav = await page.getByRole('tablist').boundingBox();
      assert.ok(box.height >= 44 && box.y + box.height <= nav.y);
    }
    assert.ok(
      await page.evaluate(() =>
        [...document.querySelectorAll('div')]
          .filter((node) => getComputedStyle(node).overflowX === 'auto')
          .every((node) => node.scrollWidth <= node.clientWidth + 1),
      ),
    );
    await page.screenshot({
      path: `${artifacts}/${engine.name()}-${width}-bottom.png`,
    });
    const card = await progress.boundingBox();
    assert.ok(card.width < 600);
    await page.getByRole('tab', { name: '홈', exact: true }).click();
    await page.waitForTimeout(350);
    await page.screenshot({
      path: `${artifacts}/${engine.name()}-${width}.png`,
    });
  }
  await page.setViewportSize({ width: 393, height: 852 });
  await open();
  const moving = await samples();
  assert.ok(
    Math.max(...moving) - Math.min(...moving) > 1.7,
    'Idle floats subtly',
  );
  assert.ok(moving.every((value) => value >= -2.01 && value <= 0.01));
  assert.ok(
    moving
      .slice(1)
      .every((value, index) => Math.abs(value - moving[index]) < 0.35),
    'No loop boundary snap',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  const still = await samples();
  assert.ok(
    still.every((value) => Math.abs(value) < 0.01),
    'Live reduced motion stops idle',
  );
  await open();
  const initiallyStill = await samples();
  assert.ok(
    initiallyStill.every((value) => Math.abs(value) < 0.01),
    'Initial reduced motion stays static',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const resumed = await samples();
  assert.ok(
    Math.max(...resumed) - Math.min(...resumed) > 1.7,
    'Idle resumes after changing startup reduced-motion preference',
  );
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(100);
  const background = await samples();
  assert.ok(
    background.every((value) => Math.abs(value) < 0.01),
    'Background stops idle',
  );
  await open();
  await page.getByRole('button', { name: '전체 보기 →', exact: true }).click();
  await page.waitForURL('**/todo');
  assert.equal(await character.count(), 0);
  await page.getByRole('tab', { name: '홈', exact: true }).click();
  await page.getByRole('button', { name: '만들러 가기', exact: true }).click();
  await page.waitForURL('**/calendar');
  for (const [label, route] of [
    ['투두', 'todo'],
    ['홈', 'main'],
    ['질문', 'persona'],
    ['마이', 'mypage'],
    ['캘린더', 'calendar'],
  ]) {
    await page.getByRole('tab', { name: label, exact: true }).click();
    await page.waitForURL(`**/${route}`);
    assert.equal(
      await page
        .getByRole('tablist')
        .getByRole('tab', { selected: true })
        .getAttribute('aria-label'),
      label,
    );
  }
  await open();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addStyleTag({
    content:
      '[dir="auto"] { font-size: 24px !important; line-height: 36px !important; } [role="heading"][aria-label] * { font-size: 48px !important; line-height: 64px !important; }',
  });
  assert.ok(
    await page
      .getByRole('heading', { name: '사랑둥이와 함께한 지 +378일' })
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  );
  await page
    .getByRole('button', { name: '만들러 가기', exact: true })
    .scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const largeAction = await page
    .getByRole('button', { name: '만들러 가기', exact: true })
    .boundingBox();
  const largeNav = await page.getByRole('tablist').boundingBox();
  assert.ok(
    largeAction.y >= 0 && largeAction.y + largeAction.height <= largeNav.y,
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: `${artifacts}/${engine.name()}-large-text.png`,
  });
  assert.deepEqual(errors, []);
  console.log(
    `PASS: ${engine.name()} main responsive layouts, exact ring/accessibility, runtime idle/reduced motion/background, actions and all tabs. Screenshots: ${artifacts}`,
  );
} finally {
  await browser.close();
}
