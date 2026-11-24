import { describe, expect, it } from 'vitest';
import {
  addDaysUtc,
  daysBetweenUtc,
  formatDateUtc,
  parseDateUtc,
  proposeStepDates,
} from './backplan';

describe('backplan helper', () => {
  const today = '2026-11-22';

  it('proposes dates in strictly non-decreasing order', () => {
    const dates = proposeStepDates('2026-12-10', 5, today);
    expect(dates).toHaveLength(5);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]! >= dates[i - 1]!).toBe(true);
    }
  });

  it('places the last step on the day before the deadline', () => {
    const deadline = '2026-12-04';
    const dates = proposeStepDates(deadline, 3, today);
    expect(dates).toHaveLength(3);
    expect(dates[2]).toBe('2026-12-03');
  });

  it('never places any step before today', () => {
    const dates = proposeStepDates('2026-11-25', 4, today);
    for (const d of dates) {
      expect(d >= today).toBe(true);
    }
  });

  it('copes with a deadline tomorrow', () => {
    const tomorrow = '2026-11-23';
    const dates1 = proposeStepDates(tomorrow, 1, today);
    expect(dates1).toEqual(['2026-11-22']);

    const dates3 = proposeStepDates(tomorrow, 3, today);
    expect(dates3).toEqual(['2026-11-22', '2026-11-22', '2026-11-22']);
    expect(dates3[dates3.length - 1]).toBe(today);
  });

  it('copes with a deadline today or in the past', () => {
    const datesToday = proposeStepDates(today, 2, today);
    expect(datesToday).toEqual([today, today]);

    const past = '2026-11-10';
    const datesPast = proposeStepDates(past, 2, today);
    expect(datesPast).toEqual([today, today]);
  });

  it('handles full ISO deadline strings with offset', () => {
    const deadlineIso = '2026-12-08T09:00:00-08:00';
    const dates = proposeStepDates(deadlineIso, 2, today);
    expect(dates).toHaveLength(2);
    expect(dates[1]).toBe('2026-12-07');
    expect(dates[0]! >= today).toBe(true);
  });

  it('handles 0 count or 1 count', () => {
    expect(proposeStepDates('2026-12-01', 0, today)).toEqual([]);
    expect(proposeStepDates('2026-12-01', 1, today)).toEqual(['2026-11-30']);
  });

  it('correctly calculates days between UTC and add days', () => {
    expect(daysBetweenUtc('2026-11-22', '2026-11-25')).toBe(3);
    expect(addDaysUtc('2026-11-22', 3)).toBe('2026-11-25');
    expect(formatDateUtc(parseDateUtc('2026-02-28') + 86_400_000)).toBe('2026-03-01');
  });
});
