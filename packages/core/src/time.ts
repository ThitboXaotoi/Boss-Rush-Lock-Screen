// All calendar arithmetic uses the plan's zone. UTC midnight is just an ordinal for a
// date: subtracting two such midnights counts days even when a local day isn't 24 hours.
const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function midnightUtc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function utcDate(at: number): string {
  return new Date(at).toISOString().split('T')[0]!;
}

export function daysBetween(start: string, end: string): number {
  return (midnightUtc(end) - midnightUtc(start)) / DAY_MS;
}

export function addDays(date: string, count: number): string {
  return utcDate(midnightUtc(date) + count * DAY_MS);
}

export function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const at = midnightUtc(value);
  // Date.parse can roll a nonexistent February 29 (or even February 30) into March.
  return Number.isFinite(at) && utcDate(at) === value;
}

/** Read an ISO date-time with an explicit offset, never a host-local date string. */
export function deadlineMs(value: unknown): number {
  if (typeof value !== 'string') return NaN;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:Z|([+-])(\d{2})(?::?(\d{2}))?)$/i.exec(value);
  if (!match) return NaN;
  const [, date, hh, mm, ss = '00', fraction = '', sign, offsetH = '00', offsetM = '00'] = match;
  if (!isLocalDate(date)) return NaN;
  const hour = Number(hh), minute = Number(mm), second = Number(ss);
  const offsetHours = Number(offsetH), offsetMinutes = Number(offsetM);
  if (hour > 24 || minute > 59 || second > 59 || offsetHours > 23 || offsetMinutes > 59) return NaN;
  if (hour === 24 && (minute || second || /[1-9]/.test(fraction))) return NaN;

  const offset = (sign === '-' ? -1 : 1) * (offsetHours * 60 + offsetMinutes);
  const ms = Number(fraction.slice(0, 3).padEnd(3, '0'));
  return midnightUtc(date) + hour * HOUR_MS + (minute - offset) * MINUTE_MS + second * 1000 + ms;
}

/** One formatter per operation, shared by every boss or pack slot in that operation. */
export function clockFor(timeZone: string) {
  // Some Intl implementations also accept literal offsets; the plan requires a named zone.
  if (!timeZone || /^[+-]/.test(timeZone)) throw new RangeError('Expected a named time zone.');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    calendar: 'iso8601',
    numberingSystem: 'latn',
    era: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    second: '2-digit',
  });

  function local(at: number) {
    const fields = Object.fromEntries(formatter.formatToParts(at).map(p => [p.type, p.value]));
    const year = fields.era === 'BC' ? 1 - Number(fields.year) : Number(fields.year);
    const isoYear = year >= 0 && year <= 9999
      ? String(year).padStart(4, '0')
      : `${year < 0 ? '-' : '+'}${String(Math.abs(year)).padStart(6, '0')}`;
    return {
      date: `${isoYear}-${fields.month}-${fields.day}`,
      hour: Number(fields.hour),
      minute: Number(fields.minute),
      second: Number(fields.second),
    };
  }

  // Express a local reading on the same UTC scale as the requested date and hour.
  function wallAt(at: number): number {
    const { date, hour, minute, second } = local(at);
    return midnightUtc(date) + hour * HOUR_MS + minute * MINUTE_MS + second * 1000;
  }

  function atHour(date: string, hour: number): number {
    const target = midnightUtc(date) + hour * HOUR_MS;
    // The offset on either side of a clock change can give a candidate for this hour.
    const before = target - DAY_MS, after = target + DAY_MS;
    const a = target - (wallAt(before) - before);
    const b = target - (wallAt(after) - after);
    if (a === b) return a;

    let low = Math.min(a, b), high = Math.max(a, b);
    if (wallAt(low) === target) return low; // First occurrence when the clock repeats.
    if (wallAt(high) === target) return high;

    // Neither candidate exists on the wall clock: the hour lies in a jump forward.
    // Find the transition itself, not the requested time plus the length of the gap.
    while (high - low > 1) {
      const mid = low + Math.floor((high - low) / 2);
      if (wallAt(mid) < target) low = mid;
      else high = mid;
    }
    return high;
  }

  return { local, atHour };
}
