import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function compile(path, dependencies) {
  const module = { exports: {} };
  const source = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    },
  ).outputText;
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    Date,
    require: dependencies,
  });
  return module.exports;
}
const dates = compile('../src/lib/onboarding.ts', () => ({}));
for (const value of ['2024-02-29', '2024-04-30', '2000-01-01']) {
  assert.equal(dates.localDate(dates.parseDate(value)), value);
}
for (const value of ['2023-02-29', '2024-04-31', '0000-01-01'])
  assert.equal(dates.parseDate(value), null);
assert.equal(dates.dateLabel('2024-02-29'), '2024년 2월 29일');
assert.equal(dates.dateLabel(''), '날짜 선택');
assert.equal(dates.localDate(new Date(2024, 1, 29, 0, 0)), '2024-02-29');
assert.equal(dates.localDate(new Date(2024, 1, 29, 23, 59)), '2024-02-29');
const selection = compile('../src/lib/date-selection.ts', () => dates);
const { initialSelection, clampSelection, partMaximum, selectionValue } =
  selection;
assert.equal(
  selectionValue(initialSelection('2024-02-29', '2026-11-14')),
  '2024-02-29',
);
assert.equal(
  selectionValue(clampSelection({ year: 2023, month: 2, day: 29 })),
  '2023-02-28',
);
assert.equal(
  selectionValue(clampSelection({ year: 2024, month: 4, day: 31 })),
  '2024-04-30',
);
assert.equal(
  selectionValue(clampSelection({ year: 1900, month: 2, day: 29 })),
  '1900-02-28',
);
assert.equal(
  selectionValue(clampSelection({ year: 2000, month: 2, day: 29 })),
  '2000-02-29',
);
assert.equal(
  selectionValue(
    clampSelection({ year: 2027, month: 12, day: 31 }, '2026-11-14'),
  ),
  '2026-11-14',
);
assert.equal(
  selectionValue(clampSelection({ year: 1, month: 1, day: 1 })),
  '0001-01-01',
);
assert.equal(
  partMaximum({ year: 2026, month: 11, day: 14 }, 'month', '2026-11-14'),
  11,
);
assert.equal(
  partMaximum({ year: 2026, month: 11, day: 14 }, 'day', '2026-11-14'),
  14,
);
assert.equal(
  partMaximum({ year: 2025, month: 11, day: 14 }, 'day', '2026-11-14'),
  30,
);
assert.equal(partMaximum({ year: 2026, month: 11, day: 14 }, 'year'), 9999);
assert.equal(
  selectionValue(clampSelection({ year: 2027, month: 3, day: 15 })),
  '2027-03-15',
  'due dates remain unrestricted',
);
console.log(
  `PASS shared date selection: local dates, leap/month/year boundaries, maximum, due-date range (${process.env.TZ})`,
);
