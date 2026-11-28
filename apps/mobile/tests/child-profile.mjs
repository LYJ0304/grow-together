import assert from 'node:assert/strict';
import { loadAuthModule } from './auth-loader.mjs';
const { validateChildProfile } = loadAuthModule(
  {},
  '../src/lib/child-profile.ts',
);
for (const birthday of ['2023-02-29', '2024-04-31', 'bad', '2999-01-01'])
  assert.ok(validateChildProfile({ name: '하늘', birthday }).birthday);
for (const birthday of ['0001-01-01', '0099-12-31', '2000-02-29'])
  assert.equal(
    validateChildProfile({ name: '하늘', birthday }).birthday,
    undefined,
  );
assert.ok(validateChildProfile({ name: ' ', birthday: '2024-03-15' }).name);
assert.ok(
  validateChildProfile({ name: '가'.repeat(51), birthday: '2024-03-15' }).name,
);
console.log('PASS child profile validation');
