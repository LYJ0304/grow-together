import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const brand = new URL('../assets/images/brand/', import.meta.url);
assert(
  existsSync(new URL('emblem.svg', brand)),
  'Launch brand must have an authoritative scalable emblem',
);
const svg = readFileSync(new URL('emblem.svg', brand), 'utf8');
assert(
  !/<(?:image|text|rect)\b/.test(svg),
  'Emblem must exclude reference background and lettering',
);
const geometry = JSON.parse(readFileSync(new URL('emblem.json', brand)));
assert.deepEqual(
  geometry.strokes.map((s) => s.id),
  ['enclosing-curve', 'heart', 'sprout', 'accent-1', 'accent-2', 'accent-3'],
);
let end = 0;
for (const stroke of geometry.strokes) {
  assert(
    svg.includes(stroke.d),
    'Runtime geometry must come from the authoritative SVG',
  );
  assert.equal(stroke.delayMs, end);
  assert(stroke.length > 0 && stroke.durationMs > 0);
  end += stroke.durationMs;
}
assert(Math.abs(end - 2400) < 0.001);
const [outer, heart, sprout] = geometry.strokes;
assert(
  outer.strokeWidth < heart.strokeWidth,
  'Enclosing curve must stay lighter than the heart',
);
assert(
  Math.abs(outer.length / outer.durationMs - heart.length / heart.durationMs) <
    0.0001,
);
assert(
  Math.abs(
    heart.length / heart.durationMs - sprout.length / sprout.durationMs,
  ) < 0.0001,
);
const config = JSON.parse(
  readFileSync(new URL('../app.json', import.meta.url)),
).expo;
assert.equal(config.ios.icon, config.icon);
assert.equal(config.android.adaptiveIcon.backgroundColor, '#FAF9F9');
assert(!config.android.adaptiveIcon.backgroundImage);
for (const path of [
  config.icon,
  config.web.favicon,
  config.android.adaptiveIcon.foregroundImage,
  config.android.adaptiveIcon.monochromeImage,
]) {
  assert(existsSync(new URL(`../${path}`, import.meta.url)));
}
console.log(
  'PASS authoritative SVG, generated geometry, timeline, lighter arc and platform asset config',
);
