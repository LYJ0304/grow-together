// UI calendar helpers only. Statistics and report eligibility belong to the API.
export function shiftReportDate(date: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(days))
    throw new Error('날짜를 확인해주세요.');
  const parsed = new Date(`${date}T12:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    throw new Error('날짜를 확인해주세요.');
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function currentReportWeek(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shiftReportDate(date, -((day + 6) % 7));
}
