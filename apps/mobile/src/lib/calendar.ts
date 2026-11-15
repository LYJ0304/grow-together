export function shiftCalendarDate(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getWeek(date: Date, weekStartsOn: 0 | 1 = 0): Date[] {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() - weekStartsOn + 7) % 7));
  return Array.from({ length: 7 }, (_, index) =>
    shiftCalendarDate(start, index),
  );
}

export function calendarDays(month: Date, weekStartsOn: 0 | 1 = 0): Date[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday =
    (new Date(year, monthIndex, 1).getDay() - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const weekCount = Math.ceil((firstWeekday + daysInMonth) / 7);
  return Array.from(
    { length: weekCount * 7 },
    (_, index) => new Date(year, monthIndex, index - firstWeekday + 1),
  );
}
