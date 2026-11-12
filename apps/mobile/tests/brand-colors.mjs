import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(
  new URL('../src/theme/colors.ts', import.meta.url),
  'utf8',
);
const colors = vm.runInNewContext(
  source.replace('export const colors =', 'const colors =') + '\ncolors',
);
assert.equal(
  colors.tint,
  '#FDEDE6',
  'Approved activity-recommendation default fill',
);
assert.equal(colors.onTint, '#914C41', 'Approved default button foreground');
assert.match(
  colors.onBrand ?? '',
  /^#[0-9a-f]{6}$/i,
  'Explicit coral actions need an accessible text role',
);
for (const token of ['buttonRose', 'buttonBlush', 'buttonPetal', 'buttonMist'])
  assert.match(
    colors[token] ?? '',
    /^#[0-9a-f]{6}$/i,
    `${token} needs a centralized fill`,
  );
assert.equal(
  new Set(
    ['tint', 'buttonRose', 'buttonBlush', 'buttonPetal', 'buttonMist'].map(
      (token) => colors[token],
    ),
  ).size,
  5,
);
for (const token of ['navigationSurface', 'navigationEdge']) {
  assert.match(
    colors[token] ?? '',
    /^rgba\(255, 255, 255, 0\.\d+\)$/,
    `${token} must be an alpha-only white surface role`,
  );
}
const config = JSON.parse(
  readFileSync(new URL('../app.json', import.meta.url)),
).expo;
assert.equal(
  colors.background,
  config.android.adaptiveIcon.backgroundColor,
  'Runtime and native launch backgrounds must match',
);
const splash = config.plugins.find(
  (p) => Array.isArray(p) && p[0] === 'expo-splash-screen',
)[1];
assert.equal(
  colors.background,
  splash.backgroundColor,
  'Runtime and native splash backgrounds must match',
);
const luminance = (hex) => {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((c) => parseInt(c, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return channels.reduce(
    (sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i],
    0,
  );
};
const contrast = (a, b) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) /
  (Math.min(luminance(a), luminance(b)) + 0.05);
for (const [fg, bg, minimum] of [
  ['surface', 'primary', 4.5],
  ['onBrand', 'brand', 4.5],
  ['onBrand', 'tint', 4.5],
  ['onBrand', 'background', 4.5],
  ['surface', 'brand', 3],
  ['brand', 'surface', 3],
  ['brand', 'tint', 3],
  ['text', 'background', 4.5],
  ['muted', 'background', 4.5],
  ['muted', 'surface', 4.5],
  ['primary', 'background', 4.5],
  ['onTint', 'tint', 4.5],
  ['onTint', 'buttonRose', 4.5],
  ['onTint', 'buttonBlush', 4.5],
  ['onTint', 'buttonPetal', 4.5],
  ['onTint', 'buttonMist', 4.5],
  ['danger', 'surface', 4.5],
  ['controlBorder', 'surface', 3],
  ['controlBorder', 'background', 3],
  ['brand', 'background', 3],
])
  assert(
    contrast(colors[fg], colors[bg]) >= minimum,
    `${fg}/${bg} must meet ${minimum}:1`,
  );
// Composite the translucent navigation surface over arbitrary light/dark extremes.
const alpha = Number(colors.navigationSurface.match(/, ([0-9.]+)\)$/)[1]);
for (const backdrop of ['#000000', '#FFFFFF', colors.background]) {
  const composite =
    '#' +
    backdrop
      .slice(1)
      .match(/../g)
      .map((channel) =>
        Math.round(255 * alpha + parseInt(channel, 16) * (1 - alpha))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  assert(
    contrast(colors.muted, composite) >= 4.5,
    'Translucency preserves label contrast',
  );
  assert(
    contrast(colors.brand, composite) >= 3,
    'Translucency preserves icon contrast',
  );
}
const emblem = readFileSync(
  new URL('../assets/images/brand/emblem.svg', import.meta.url),
  'utf8',
);
const geometry = JSON.parse(
  readFileSync(new URL('../assets/images/brand/emblem.json', import.meta.url)),
);
for (const stroke of geometry.strokes) {
  assert(
    [colors.brand, colors.logoAccent].includes(stroke.stroke),
    'Logo geometry must use the documented logo palette',
  );
  assert(
    emblem.includes(stroke.stroke),
    'SVG and runtime logo palette must match',
  );
}
console.log(
  'PASS runtime/native background, logo palette and accessible color roles',
);

// UI colors must stay centralized, including SVG strings and web document CSS.
for (const directory of ['app', 'src']) {
  const root = new URL(`../${directory}/`, import.meta.url);
  for (const file of readdirSync(root, { recursive: true })) {
    if (!/\.tsx?$/.test(file) || file === 'theme/colors.ts') continue;
    const source = readFileSync(new URL(file, root), 'utf8');
    assert(
      !/#[0-9a-f]{3,8}\b|rgba?\(\s*\d/i.test(source),
      `${directory}/${file}: import semantic color tokens`,
    );
  }
}
console.log(
  'PASS shared color policy across app, components, SVG strings and web CSS',
);
