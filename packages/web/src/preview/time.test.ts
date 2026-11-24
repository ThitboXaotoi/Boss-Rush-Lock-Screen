// Brief D tests: slider position <-> epoch ms, across days when clocks change, and the
// day slider's range (brief D, "Tests").
import { fixturePlan } from '@boss-rush/core';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  civilDateTime,
  daysBetween,
  epochForCivil,
  epochForSlider,
  maxDayIndex,
  MIN_SLIDER_DAYS,
  sliderForEpoch,
} from './time';

const west = 'America/Los_Angeles';
const day0 = { year: 2026, month: 11, day: 22 }; // today for the slider tests

describe('wall-clock time <-> epoch', () => {
  it('round-trips every hour of a normal day', () => {
    for (let hour = 0; hour <= 23; hour++) {
      const ms = epochForCivil(day0, hour, 0, west);
      expect(civilDateTime(ms, west)).toEqual({ ...day0, hour, minute: 0 });
    }
  });

  it('round-trips across the fall-back day (Nov 1 2026, 25 hours)', () => {
    const date = { year: 2026, month: 11, day: 1 };
    for (const hour of [0, 1, 2, 3, 12, 23]) {
      const ms = epochForCivil(date, hour, 0, west);
      expect(civilDateTime(ms, west)).toMatchObject({ month: 11, day: 1, hour, minute: 0 });
    }
    // The day really is 25 hours long.
    expect(epochForCivil(addDays(date, 1, west), 0, 0, west) - epochForCivil(date, 0, 0, west)).toBe(
      25 * 3_600_000,
    );
  });

  it('round-trips across the spring-forward day (Mar 8 2026, 23 hours)', () => {
    const date = { year: 2026, month: 3, day: 8 };
    for (const hour of [0, 1, 3, 4, 12, 23]) {
      const ms = epochForCivil(date, hour, 0, west);
      expect(civilDateTime(ms, west)).toMatchObject({ month: 3, day: 8, hour, minute: 0 });
    }
    expect(epochForCivil(addDays(date, 1, west), 0, 0, west) - epochForCivil(date, 0, 0, west)).toBe(
      23 * 3_600_000,
    );
  });

  it('reads the ambiguous fall-back hour as its first occurrence', () => {
    // 01:00 on Nov 1 2026 happens twice; the first is 01:00 PDT = 08:00 UTC.
    expect(epochForCivil({ year: 2026, month: 11, day: 1 }, 1, 0, west)).toBe(Date.UTC(2026, 10, 1, 8));
  });

  it('reads a nonexistent spring-forward hour as the instant after the gap', () => {
    // 02:00 on Mar 8 2026 never happens; the clock jumps straight to 03:00.
    expect(civilDateTime(epochForCivil({ year: 2026, month: 3, day: 8 }, 2, 0, west), west)).toMatchObject({
      day: 8,
      hour: 3,
      minute: 0,
    });
  });

  it('keeps working when the timezone is unknown (falls back to UTC, never throws)', () => {
    const ms = epochForCivil(day0, 12, 0, 'Not/A_Zone');
    expect(civilDateTime(ms, 'Not/A_Zone')).toMatchObject({ hour: 12, minute: 0 });
  });
});

describe('slider position <-> epoch ms', () => {
  it('round-trips a day and hour through both directions', () => {
    const ms = epochForSlider({ day: 5, hour: 17 }, day0, west);
    expect(sliderForEpoch(ms, day0, west)).toEqual({ day: 5, hour: 17 });
  });

  it('maps day 1, hour 0 to local midnight (the day count changes then)', () => {
    expect(epochForSlider({ day: 1, hour: 0 }, day0, west)).toBe(Date.UTC(2026, 10, 23, 8));
  });

  it('counts civil days across a clocks-change day as one day', () => {
    expect(daysBetween({ year: 2026, month: 11, day: 1 }, { year: 2026, month: 11, day: 2 }, west)).toBe(1);
    expect(daysBetween({ year: 2026, month: 3, day: 8 }, { year: 2026, month: 3, day: 9 }, west)).toBe(1);
  });

  it('covers today to a few days past the last deadline of the fixture plan', () => {
    const now = epochForCivil(day0, 12, 0, west); // Sun Nov 22 2026, noon PST
    expect(maxDayIndex(fixturePlan, now)).toBe(36); // last deadline Dec 25 (the ??? boss), plus 3
  });

  it('keeps a minimum span when the plan has no deadlines', () => {
    const now = epochForCivil(day0, 12, 0, west);
    expect(maxDayIndex({ ...fixturePlan, bosses: [] }, now)).toBe(MIN_SLIDER_DAYS);
  });

  it('ignores deadlines that do not parse', () => {
    const now = epochForCivil(day0, 12, 0, west);
    const plan = { ...fixturePlan, bosses: [{ ...fixturePlan.bosses[0]!, deadline: 'not a date' }] };
    expect(maxDayIndex(plan, now)).toBe(MIN_SLIDER_DAYS);
  });
});
