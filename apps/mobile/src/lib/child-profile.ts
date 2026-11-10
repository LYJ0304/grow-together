import type { Personalization } from './onboarding';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChildProfile = {
  name: string;
  birthday: string;
  personalization?: Personalization;
};
export type ChildProfileErrors = { name?: string; birthday?: string };

export function validateChildProfile(
  profile: ChildProfile,
): ChildProfileErrors {
  const errors: ChildProfileErrors = {};
  if (!profile.name.trim()) errors.name = '아이 이름을 입력해주세요.';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(profile.birthday.trim());
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  if (match) {
    date.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  if (
    !match ||
    Number(match[1]) < 1 ||
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() + 1 !== Number(match[2]) ||
    date.getDate() !== Number(match[3])
  ) {
    errors.birthday = '생년월일을 올바른 YYYY-MM-DD 형식으로 입력해주세요.';
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today)
      errors.birthday = '생년월일은 오늘 또는 이전 날짜로 입력해주세요.';
  }
  if (profile.name.trim().length > 50)
    errors.name = '아이 이름은 50자 이내로 입력해주세요.';
  return errors;
}

function storageKey(accountKey: string) {
  if (!accountKey)
    throw new Error('계정을 확인하지 못했어요. 다시 로그인해 주세요.');
  return `@growtogether/child/v1/${encodeURIComponent(accountKey)}`;
}

export async function readChildProfile(
  accountKey: string,
): Promise<ChildProfile | null> {
  const key = storageKey(accountKey);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    const value = JSON.parse(raw);
    if (
      typeof value?.name !== 'string' ||
      typeof value?.birthday !== 'string' ||
      Object.keys(validateChildProfile(value)).length > 0
    )
      throw new Error('Invalid profile');
    return { name: value.name, birthday: value.birthday };
  } catch {
    throw new Error('아이 정보를 불러오지 못했어요. 다시 시도해주세요.');
  }
}

export async function saveChildProfile(
  accountKey: string,
  profile: ChildProfile,
): Promise<ChildProfile> {
  const key = storageKey(accountKey);
  const errors = validateChildProfile(profile);
  if (errors.name || errors.birthday)
    throw new Error(errors.name ?? errors.birthday);
  const value = {
    name: profile.name.trim(),
    birthday: profile.birthday.trim(),
  };
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return value;
  } catch {
    throw new Error('아이 정보를 저장하지 못했어요. 다시 시도해주세요.');
  }
}
