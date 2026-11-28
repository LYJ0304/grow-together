import assert from 'node:assert/strict';
import { loadAuthModule } from './auth-loader.mjs';
const { diaryDateKey, parseDiaryDate } = loadAuthModule(
  {},
  '../src/lib/diary-date.ts',
);
for (const key of ['2024-02-29', '2026-12-31', '2027-01-01']) {
  assert.equal(diaryDateKey(parseDiaryDate(key)), key);
}
for (const key of ['2023-02-29', '2026-04-31', '2026-13-01', 'bad'])
  assert.equal(parseDiaryDate(key), null);
console.log('PASS local calendar date round trips and invalid dates');
