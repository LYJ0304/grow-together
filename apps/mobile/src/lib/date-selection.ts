import { localDate, parseDate } from './onboarding';

export type DateParts = { year: number; month: number; day: number };
export type DatePart = keyof DateParts;
function parts(value: string): DateParts {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}
export function selectionValue(value: DateParts) {
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}
export function partMaximum(
  value: DateParts,
  part: DatePart,
  maximum?: string,
) {
  const limit = parts(maximum && parseDate(maximum) ? maximum : '9999-12-31');
  if (part === 'year') return limit.year;
  if (part === 'month') return value.year === limit.year ? limit.month : 12;
  const leap =
    value.year % 4 === 0 && (value.year % 100 !== 0 || value.year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    value.month - 1
  ];
  return value.year === limit.year && value.month === limit.month
    ? Math.min(days, limit.day)
    : days;
}
export function clampSelection(value: DateParts, maximum?: string): DateParts {
  const next = { ...value };
  for (const part of ['year', 'month', 'day'] as const)
    next[part] = Math.max(
      1,
      Math.min(next[part], partMaximum(next, part, maximum)),
    );
  return next;
}
export function initialSelection(value: string, maximum?: string) {
  return clampSelection(
    parts(parseDate(value) ? value : localDate(new Date())),
    maximum,
  );
}
