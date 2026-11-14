import { validateChildProfile, type ChildProfile } from './child-profile';

export const concernChoices = [
  ['sleep', '수면', '잠들기 어려움, 자주 깨는 문제'],
  ['feeding', '식사', '이유식, 식습관, 편식'],
  ['emotion_expression', '감정 표현', '울음, 떼쓰기, 감정 조절'],
  ['communication', '언어와 소통', '말하기, 의사 표현'],
  ['developmental_play', '발달 놀이', '아이에게 적합한 놀이 활동'],
  ['daily_habits', '생활 습관', '씻기, 정리, 규칙적인 생활'],
  ['separation_anxiety', '분리불안', '보호자와 떨어지기 어려움'],
  ['none', '특별한 고민 없음', '지금은 함께하는 하루를 기록할게요'],
] as const;
export type Concern = (typeof concernChoices)[number][0];
export const activityChoices = [
  ['5min', '5분 정도'],
  ['10min', '10분 정도'],
  ['15to20min', '15~20분 정도'],
  ['flexible', '매일 달라요'],
] as const;
export type Personalization = {
  prematurityStatus: 'yes' | 'no' | 'unknown' | null;
  expectedDueDate: string | null;
  concerns: Concern[];
  availableActivityTime: (typeof activityChoices)[number][0] | null;
  developmentObservations: never[];
};
export type OnboardingProfile = ChildProfile & {
  personalization: Personalization;
};
export const emptyPersonalization = (): Personalization => ({
  prematurityStatus: null,
  expectedDueDate: null,
  concerns: [],
  availableActivityTime: null,
  developmentObservations: [],
});
export function localDate(value: Date) {
  return `${String(value.getFullYear()).padStart(4, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
export function parseDate(value: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts || Number(parts[1]) < 1) return null;
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  return localDate(date) === value ? date : null;
}
export function ageInMonths(birthday: string, today = localDate(new Date())) {
  const born = parseDate(birthday),
    now = parseDate(today);
  if (!born || !now || birthday > today) return null;
  return (
    (now.getFullYear() - born.getFullYear()) * 12 +
    now.getMonth() -
    born.getMonth() -
    Number(now.getDate() < born.getDate())
  );
}
export function toggleConcern(current: Concern[], code: Concern): Concern[] {
  if (current.includes(code)) return current.filter((item) => item !== code);
  if (code === 'none') return ['none'];
  const next = current.filter((item) => item !== 'none');
  return next.length < 2 ? [...next, code] : current;
}
export function validPersonalization(value: unknown): value is Personalization {
  if (!value || typeof value !== 'object') return false;
  const p = value as Personalization;
  return (
    [null, 'yes', 'no', 'unknown'].includes(p.prematurityStatus) &&
    (p.expectedDueDate === null ||
      (typeof p.expectedDueDate === 'string' &&
        !!parseDate(p.expectedDueDate))) &&
    Array.isArray(p.concerns) &&
    p.concerns.length <= 2 &&
    new Set(p.concerns).size === p.concerns.length &&
    p.concerns.every((c) => concernChoices.some(([code]) => code === c)) &&
    (!p.concerns.includes('none') || p.concerns.length === 1) &&
    [null, ...activityChoices.map(([code]) => code)].includes(
      p.availableActivityTime,
    ) &&
    Array.isArray(p.developmentObservations) &&
    p.developmentObservations.length === 0
  );
}
export function validateOnboarding(profile: OnboardingProfile) {
  const errors: Record<string, string> = { ...validateChildProfile(profile) };
  const p = profile.personalization;
  if (!validPersonalization(p))
    errors.concerns = '선택한 정보를 다시 확인해주세요.';
  if (
    p.expectedDueDate &&
    (p.prematurityStatus !== 'yes' ||
      !parseDate(p.expectedDueDate) ||
      p.expectedDueDate <= profile.birthday)
  )
    errors.expectedDueDate = '출산 예정일은 실제 생년월일보다 뒤여야 해요.';
  return errors;
}
export function personalizationSaved(
  input: OnboardingProfile,
  result: ChildProfile,
) {
  const p = result.personalization;
  return (
    result.name === input.name.trim() &&
    result.birthday === input.birthday &&
    validPersonalization(p) &&
    p.prematurityStatus === input.personalization.prematurityStatus &&
    p.expectedDueDate === input.personalization.expectedDueDate &&
    p.availableActivityTime === input.personalization.availableActivityTime &&
    JSON.stringify(p.concerns) ===
      JSON.stringify(input.personalization.concerns)
  );
}

// A reviewed definition is required before the API can accept any answer IDs.
export type ObservationQuestion = {
  questionId: string;
  version: string;
  domain:
    | 'gross_motor'
    | 'fine_motor'
    | 'cognitive'
    | 'communication'
    | 'social_emotional'
    | 'self_care';
  minAgeMonths: number;
  maxAgeMonths: number;
  ageBasis: 'chronological' | 'corrected';
  source: { title: string; url: string };
  reviewed: true;
  text: string;
};
// No validated catalog is available. Never substitute generated milestones.
export const approvedObservationQuestions: readonly ObservationQuestion[] = [];

export function withPrematurity(
  value: Personalization,
  status: Personalization['prematurityStatus'],
): Personalization {
  return {
    ...value,
    prematurityStatus: status,
    expectedDueDate: status === 'yes' ? value.expectedDueDate : null,
  };
}

export function dateLabel(value: string) {
  const date = parseDate(value);
  return date
    ? `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
    : '날짜 선택';
}
