/**
 * Back-planning helper:
 * Given a deadline and a number of steps, propose due dates working backward:
 * the last step one day before the deadline, the others spaced evenly back to today.
 * None is before today. Copes with deadline tomorrow (or today/past).
 */

export function parseDateUtc(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

export function formatDateUtc(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysUtc(dateStr: string, days: number): string {
  return formatDateUtc(parseDateUtc(dateStr) + days * 86_400_000);
}

export function daysBetweenUtc(startStr: string, endStr: string): number {
  return Math.round((parseDateUtc(endStr) - parseDateUtc(startStr)) / 86_400_000);
}

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function proposeStepDates(
  deadlineDate: string,
  count: number,
  todayDate: string = getTodayDateString(),
): string[] {
  if (count <= 0) return [];

  // Extract YYYY-MM-DD if deadlineDate is a full ISO timestamp
  const dateOnly = deadlineDate.includes('T') ? deadlineDate.split('T')[0]! : deadlineDate;

  // The last step is one day before the deadline
  const dayBeforeDeadline = addDaysUtc(dateOnly, -1);
  // None is before today
  const targetEnd = dayBeforeDeadline < todayDate ? todayDate : dayBeforeDeadline;

  if (count === 1) {
    return [targetEnd];
  }

  const totalDays = daysBetweenUtc(todayDate, targetEnd);
  if (totalDays <= 0) {
    return Array<string>(count).fill(todayDate);
  }

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const fraction = i / (count - 1);
    const dayOffset = Math.round(fraction * totalDays);
    const date = addDaysUtc(todayDate, dayOffset);
    if (result.length > 0 && date < result[result.length - 1]!) {
      result.push(result[result.length - 1]!);
    } else {
      result.push(date);
    }
  }
  return result;
}
