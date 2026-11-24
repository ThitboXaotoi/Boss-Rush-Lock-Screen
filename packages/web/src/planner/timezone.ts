/**
 * Timezone and deadline string formatting helpers.
 */

export function getTimezoneOffsetString(timeZone: string, dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(d);
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value;
    if (!tzPart || tzPart === 'GMT') return 'Z';
    return tzPart.replace('GMT', '');
  } catch {
    return 'Z';
  }
}

export interface ParsedDeadline {
  date: string;
  time: string;
  offset: string;
}

export function parseDeadline(deadline: string | null): ParsedDeadline | null {
  if (!deadline) return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?(?:Z|([+-]\d{2}:\d{2}))?$/i.exec(deadline);
  if (!match) return null;
  const [, date, time, offset = 'Z'] = match;
  return { date: date!, time: time!, offset: offset ?? 'Z' };
}

export function formatDeadlineIso(date: string, time: string, timeZone: string): string {
  const offset = getTimezoneOffsetString(timeZone, date);
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return `${date}T${normalizedTime}${offset}`;
}
