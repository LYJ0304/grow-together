import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL('../src/lib/features/report/week.ts', import.meta.url),
      'utf8',
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  { exports, Date, Intl },
);
const { currentReportWeek, shiftReportDate } = exports;
assert.equal(
  currentReportWeek(new Date('2026-11-08T14:59:59Z')),
  '2026-11-02',
  'Seoul Sunday still belongs to the previous ISO week',
);
assert.equal(
  currentReportWeek(new Date('2026-11-08T15:00:00Z')),
  '2026-11-09',
  'Seoul Monday starts a new week',
);
assert.equal(currentReportWeek(new Date('2025-01-01T03:00:00Z')), '2024-12-30');
assert.equal(shiftReportDate('2024-02-26', 6), '2024-03-03');
assert.equal(shiftReportDate('2024-12-30', 7), '2025-01-06');
assert.throws(() => shiftReportDate('2024-02-30', 7));
assert.throws(() => shiftReportDate('2026-11-01', 0.5));
console.log(
  'PASS Seoul ISO-week boundaries, year/leap rollover and strict calendar dates',
);
