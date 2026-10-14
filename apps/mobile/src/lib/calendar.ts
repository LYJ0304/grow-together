export function calendarDays(month: Date): Date[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const weekCount = Math.ceil((firstWeekday + daysInMonth) / 7);

  return Array.from(
    { length: weekCount * 7 },
    (_, index) => new Date(year, monthIndex, index - firstWeekday + 1),
  );
}
