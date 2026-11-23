export type AuthFieldName =
  'name' | 'email' | 'password' | 'passwordConfirmation';
export type AuthFormValues = Record<AuthFieldName, string>;
export type AuthFormErrors = Partial<Record<AuthFieldName, string>>;
export const authFieldOrder: AuthFieldName[] = [
  'name',
  'email',
  'password',
  'passwordConfirmation',
];
export function validateAuthForm(
  mode: 'login' | 'signup',
  values: AuthFormValues,
): AuthFormErrors {
  const errors: AuthFormErrors = {};
  if (mode === 'signup') {
    if (!values.name.trim()) errors.name = '이름을 입력해 주세요.';
    else if (values.name.trim().length > 50)
      errors.name = '이름은 50자 이내로 입력해 주세요.';
  }
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim()))
    errors.email = '올바른 이메일 주소를 입력해 주세요.';
  else if (values.email.trim().length > 254)
    errors.email = '이메일은 254자 이내로 입력해 주세요.';
  if (!values.password.trim() || values.password.length < 8)
    errors.password = '비밀번호를 8자 이상 입력해 주세요.';
  else if (values.password.length > 72)
    errors.password = '비밀번호는 72자 이내로 입력해 주세요.';
  if (mode === 'signup') {
    if (!values.passwordConfirmation)
      errors.passwordConfirmation = '비밀번호를 다시 입력해 주세요.';
    else if (values.password !== values.passwordConfirmation)
      errors.passwordConfirmation = '비밀번호가 일치하지 않아요.';
  }
  return errors;
}
