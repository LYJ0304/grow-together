import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = await readFile(
  new URL('../src/lib/calendar.ts', import.meta.url),
  'utf8',
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
});
const module = { exports: {} };
vm.runInNewContext(outputText, { module, exports: module.exports, Date });
const { calendarDays } = module.exports;

for (const [year, month, weeks, first, last] of [
  [2026, 9, 5, '2026-09-27', '2026-10-31'],
  [2026, 1, 4, '2026-02-01', '2026-02-28'],
  [2026, 7, 6, '2026-07-26', '2026-09-05'],
  [2028, 1, 5, '2028-01-30', '2028-03-04'],
  [2026, 11, 5, '2026-11-29', '2027-01-02'],
  [2027, 0, 6, '2026-12-27', '2027-02-06'],
]) {
  const input = new Date(year, month, 15);
  const original = input.getTime();
  const days = calendarDays(input);
  const key = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  assert.equal(input.getTime(), original, 'Do not mutate the displayed month');
  assert.equal(days.length, weeks * 7);
  assert.equal(key(days[0]), first);
  assert.equal(key(days.at(-1)), last);
}

// Cover every weekday/month length combination and both US DST transitions.
for (let year = 2024; year <= 2032; year++) {
  for (let month = 0; month < 12; month++) {
    const days = calendarDays(new Date(year, month, 1));
    const inMonth = days.filter(
      (date) => date.getFullYear() === year && date.getMonth() === month,
    );
    const count = new Date(year, month + 1, 0).getDate();
    assert.equal(inMonth.length, count);
    assert.equal(new Set(inMonth.map((date) => date.getDate())).size, count);
    assert.equal(inMonth[0].getDate(), 1);
    assert.equal(inMonth.at(-1).getDate(), count);
    assert.ok(days.length >= 28 && days.length <= 42);
    assert.equal(days[0].getDay(), 0);
    assert.equal(days.at(-1).getDay(), 6);
    assert.ok(days.slice(0, 7).some((date) => date.getMonth() === month));
    assert.ok(days.slice(-7).some((date) => date.getMonth() === month));
    days.forEach((date, index) => {
      assert.equal(date.getDay(), index % 7);
      assert.equal(date.getHours(), 0);
      if (index > 0) {
        const previous = days[index - 1];
        const next = new Date(
          previous.getFullYear(),
          previous.getMonth(),
          previous.getDate() + 1,
        );
        assert.equal(date.getTime(), next.getTime());
      }
    });
  }
}
console.log(
  `PASS: minimal 4/5/6-week grids, leap years, year boundaries, local dates/DST (${process.env.TZ ?? 'system timezone'})`,
);
