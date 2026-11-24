// Civil time in the plan's timezone: slider position <-> epoch ms (brief D spec 3).
// Pure: every function takes the timezone and the epoch as parameters, so the tests are
// fixed-input. core/src/time.ts keeps a clock like this for derive(), but the core package
// does not export it; this is the web copy (see status/D-preview.md, "Needs from integrator").
import type { Plan } from '@boss-rush/core';

export interface CivilDate {
  year: number;
  /** 1..12 */
  month: number;
  /** 1..31 */
  day: number;
}

export interface CivilDateTime extends CivilDate {
  hour: number;
  minute: number;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
const wordsFormatters = new Map<string, Intl.DateTimeFormat>();
const dayWordFormatters = new Map<string, Intl.DateTimeFormat>();
const shortDateFormatters = new Map<string, Intl.DateTimeFormat>();
const dayLabelFormatters = new Map<string, Intl.DateTimeFormat>();

/** A cached formatter per timezone; an unknown timezone falls back to UTC, never throws. */
function formatterFor(
  cache: Map<string, Intl.DateTimeFormat>,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const cached = cache.get(timeZone);
  if (cached) return cached;
  let dtf: Intl.DateTimeFormat;
  try {
    dtf = new Intl.DateTimeFormat('en-US', { ...options, timeZone });
  } catch {
    dtf = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' });
  }
  cache.set(timeZone, dtf);
  return dtf;
}

/** Wall-clock date and time in `timeZone` at epoch `ms`. */
export function civilDateTime(ms: number, timeZone: string): CivilDateTime {
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;
  for (const part of formatterFor(partsFormatters, timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ms)) {
    switch (part.type) {
      case 'year':
        year = Number(part.value);
        break;
      case 'month':
        month = Number(part.value);
        break;
      case 'day':
        day = Number(part.value);
        break;
      case 'hour':
        hour = Number(part.value);
        break;
      case 'minute':
        minute = Number(part.value);
        break;
    }
  }
  return { year, month, day, hour, minute };
}

/** Wall-clock date in `timeZone` at epoch `ms`. */
export function civilDate(ms: number, timeZone: string): CivilDate {
  const { year, month, day } = civilDateTime(ms, timeZone);
  return { year, month, day };
}

/** Offset of `timeZone` from UTC at epoch `ms`, in ms (civil = utc + offset). */
function tzOffsetMs(ms: number, timeZone: string): number {
  const c = civilDateTime(ms, timeZone);
  return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute) - ms;
}

function matches(c: CivilDateTime, date: CivilDate, hour: number, minute: number): boolean {
  return (
    c.year === date.year &&
    c.month === date.month &&
    c.day === date.day &&
    c.hour === hour &&
    c.minute === minute
  );
}

/**
 * Epoch ms of a wall-clock time in `timeZone`.
 * A time read twice when clocks fall back resolves to the first reading; a time inside a
 * spring-forward gap does not exist and resolves to the instant just after the gap.
 */
export function epochForCivil(date: CivilDate, hour: number, minute: number, timeZone: string): number {
  const naive = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  const first = naive - tzOffsetMs(naive, timeZone);
  if (matches(civilDateTime(first, timeZone), date, hour, minute)) return first;
  const second = naive - tzOffsetMs(first, timeZone);
  if (matches(civilDateTime(second, timeZone), date, hour, minute)) return second;
  return first;
}

const DAY_MS = 86_400_000;
/** Noon keeps day arithmetic clear of every clock change. */
const NOON_HOUR = 12;

/** `date` shifted by whole civil days. */
export function addDays(date: CivilDate, days: number, timeZone: string): CivilDate {
  return civilDate(epochForCivil(date, NOON_HOUR, 0, timeZone) + days * DAY_MS, timeZone);
}

/** Whole civil days from `from` to `to` (negative when `to` is the earlier date). */
export function daysBetween(from: CivilDate, to: CivilDate, timeZone: string): number {
  const a = epochForCivil(from, NOON_HOUR, 0, timeZone);
  const b = epochForCivil(to, NOON_HOUR, 0, timeZone);
  return Math.round((b - a) / DAY_MS);
}

/** One step of the time controls: a day index (0 = `day0`) plus a wall-clock hour. */
export interface SliderTime {
  day: number;
  hour: number;
}

/** Epoch ms of a slider position, in the plan's timezone. */
export function epochForSlider(time: SliderTime, day0: CivilDate, timeZone: string): number {
  return epochForCivil(addDays(day0, time.day, timeZone), time.hour, 0, timeZone);
}

/** Slider position of an epoch. Days before `day0` clamp to day 0. */
export function sliderForEpoch(ms: number, day0: CivilDate, timeZone: string): SliderTime {
  return {
    day: Math.max(0, daysBetween(day0, civilDate(ms, timeZone), timeZone)),
    hour: civilDateTime(ms, timeZone).hour,
  };
}

/** Days the slider reaches past the last deadline ("a few", brief D spec 3). */
export const PAST_LAST_DEADLINE_DAYS = 3;
/** Slider span for a plan with no deadline to aim at. */
export const MIN_SLIDER_DAYS = 7;

/**
 * Last day index of the day slider: today (day 0) to a few days past the plan's last
 * deadline, never less than `MIN_SLIDER_DAYS`. Unparseable deadlines are ignored: no
 * control of this tab may produce an error.
 */
export function maxDayIndex(plan: Plan, now: number): number {
  const timeZone = plan.timezone;
  const today = civilDate(now, timeZone);
  let furthest = Number.NEGATIVE_INFINITY;
  for (const boss of plan.bosses) {
    if (!boss.deadline) continue;
    const ms = Date.parse(boss.deadline);
    if (!Number.isFinite(ms)) continue;
    furthest = Math.max(furthest, daysBetween(today, civilDate(ms, timeZone), timeZone));
  }
  if (!Number.isFinite(furthest)) return MIN_SLIDER_DAYS;
  return Math.max(MIN_SLIDER_DAYS, furthest + PAST_LAST_DEADLINE_DAYS);
}

/** The simulated date and time in words, e.g. "Sunday, November 22 at 4:00 PM PST". */
export function formatCivil(ms: number, timeZone: string): string {
  return formatterFor(wordsFormatters, timeZone, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(ms);
}

/** Date without a time, e.g. "Sunday, November 22": the fake clock's second line. */
export function formatDayWords(ms: number, timeZone: string): string {
  return formatterFor(dayWordFormatters, timeZone, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(ms);
}

/** Short date, e.g. "Nov 23": the fake widget and notification lines. */
export function formatShortDate(ms: number, timeZone: string): string {
  return formatterFor(shortDateFormatters, timeZone, { month: 'short', day: 'numeric' }).format(ms);
}

/** Short label for one day of the day slider, e.g. "Sun, Nov 22". */
export function formatDayLabel(dayIndex: number, day0: CivilDate, timeZone: string): string {
  const noon = epochForCivil(addDays(day0, dayIndex, timeZone), NOON_HOUR, 0, timeZone);
  return formatterFor(dayLabelFormatters, timeZone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(noon);
}
