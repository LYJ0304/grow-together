import assert from 'node:assert/strict';
import { validateAuthForm } from '../src/lib/features/auth/form-validation.ts';
const valid = {
  name: '보호자',
  email: 'parent@example.com',
  password: '12345678',
  passwordConfirmation: '12345678',
};
assert.deepEqual(
  Object.keys(
    validateAuthForm('signup', {
      name: '',
      email: '',
      password: '',
      passwordConfirmation: '',
    }),
  ),
  ['name', 'email', 'password', 'passwordConfirmation'],
);
assert.deepEqual(validateAuthForm('signup', valid), {});
assert.deepEqual(
  validateAuthForm('login', { ...valid, name: '', passwordConfirmation: '' }),
  {},
);
for (const [field, value] of [
  ['name', '가'.repeat(51)],
  ['email', 'a'.repeat(243) + '@example.com'],
  ['password', 'a'.repeat(73)],
])
  assert(validateAuthForm('signup', { ...valid, [field]: value })[field]);
const boundary = {
  name: '가'.repeat(50),
  email: 'a'.repeat(242) + '@example.com',
  password: 'a'.repeat(72),
  passwordConfirmation: 'a'.repeat(72),
};
assert.deepEqual(validateAuthForm('signup', boundary), {});
assert(validateAuthForm('signup', { ...valid, password: '1234567' }).password);
assert(validateAuthForm('signup', { ...valid, password: '        ' }).password);
assert(
  validateAuthForm('signup', { ...valid, passwordConfirmation: 'different' })
    .passwordConfirmation,
);
const spaced = {
  ...valid,
  name: ' 보호자 ',
  email: ' parent@example.com ',
  password: ' abcdef ',
  passwordConfirmation: ' abcdef ',
};
const snapshot = structuredClone(spaced);
assert.deepEqual(validateAuthForm('signup', spaced), {});
assert.deepEqual(spaced, snapshot);
console.log('auth form validation passed');
