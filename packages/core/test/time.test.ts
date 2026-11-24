import { describe, expect, it } from 'vitest';
import { derive, fixturePlan, packEntries, PACK_SLOTS, validatePlan, type Plan } from '../src';
import { clockFor } from '../src/time';

const west = 'America/Los_Angeles';
const east = 'Asia/Ho_Chi_Minh';

function plan(timezone: string, deadline: string): Plan {
  return {
    ...fixturePlan,
    timezone,
    settings: {
      ...fixturePlan.settings, timeOfDay: true, phaseDays: { awake: 14, enraged: 7, final: 3, now: 1 },
    },
    bosses: [{ ...fixturePlan.bosses[0]!, deadline, steps: [] }],
  };
}

describe('Los Angeles clock changes', () => {
  it.each(['2026-03-08', '2027-03-14'])('resolves the nonexistent 02:00 on %s to the first instant after the jump', date => {
    const clock = clockFor(west);
    const jump = Date.parse(`${date}T10:00:00Z`);
    expect(clock.local(jump - 1)).toMatchObject({ date, hour: 1, minute: 59, second: 59 });
    expect(clock.local(jump)).toMatchObject({ date, hour: 3, minute: 0, second: 0 });
    expect(clock.atHour(date, 2)).toBe(jump);
    expect(clock.atHour(date, 3)).toBe(jump);
  });

  it.each(['2026-11-01', '2027-11-07'])('chooses the earlier of the two readings of 01:00 on %s', date => {
    const clock = clockFor(west);
    const first = Date.parse(`${date}T08:00:00Z`);
    const second = Date.parse(`${date}T09:00:00Z`);
    expect(clock.local(first)).toEqual(clock.local(second));
    expect(clock.atHour(date, 1)).toBe(first);
    expect(clock.atHour(date, 2)).toBe(Date.parse(`${date}T10:00:00Z`));
  });

  it.each([
    ['2026-03-08', '2026-03-09', '-08:00', '-07:00', 23],
    ['2026-11-01', '2026-11-02', '-07:00', '-08:00', 25],
    ['2027-03-14', '2027-03-15', '-08:00', '-07:00', 23],
    ['2027-11-07', '2027-11-08', '-07:00', '-08:00', 25],
  ] as const)('keeps five wall-clock slots on %s through %s (%s to %s, %i h day)', (date, next, before, after, hours) => {
    const start = Date.parse(`${date}T00:00:00${before}`);
    const p = plan(west, `${next}T00:00:00${after}`);
    expect(derive(p, start).front).toMatchObject({
      daysLeft: 1, hoursLeft: hours, phase: hours < 24 ? 'now' : 'final',
    });
    const entries = packEntries(p, start);
    expect(entries).toHaveLength(10);
    expect(entries[5]!.at - entries[0]!.at).toBe(hours * 3_600_000);
    for (const [i, entry] of entries.entries()) {
      const { slot, hour, sky } = PACK_SLOTS[i % 5]!;
      const expectedDate = i < 5 ? date : next;
      const offset = i === 0 ? before : after;
      expect(entry).toMatchObject({
        date: expectedDate, slot,
        at: Date.parse(`${expectedDate}T${String(hour).padStart(2, '0')}:00:00${offset}`),
      });
      expect(derive(p, entry.at).sky).toBe(sky);
    }
  });
});

describe('Asia/Ho_Chi_Minh', () => {
  const midnight = Date.parse('2026-11-16T17:00:00Z'); // Nov 17 here; still Nov 16 in LA.
  const deadline = '2026-11-17T17:15:00Z';              // Nov 18, 00:15 here.

  it('advances local days and NEXT at midnight even though the whole hours remaining do not change', () => {
    const p = plan(east, deadline);
    p.bosses[0]!.steps = [
      { id: 'old', due: '2026-11-16', label: 'Old step' },
      { id: 'new', due: '2026-11-17', label: 'New step' },
      { id: 'last', due: '2026-11-18', label: 'Last step' },
    ];
    expect(derive(p, midnight - 60_000)).toMatchObject({
      sky: 'night', front: { daysLeft: 2, hoursLeft: 24 }, nextStep: { stepId: 'old' },
    });
    expect(derive(p, midnight)).toMatchObject({
      sky: 'night', front: { daysLeft: 1, hoursLeft: 24 }, nextStep: { stepId: 'new' },
    });
    expect(validatePlan(p)).toEqual([]); // The last step shares the deadline's local day.

    const inLA = { ...p, timezone: west };
    expect(derive(inLA, midnight)).toMatchObject({ sky: 'day', nextStep: { stepId: 'old' } });
    expect(validatePlan(inLA).map(i => i.path)).toEqual(['bosses[0].steps[2].due']);
  });

  it('starts each pack slot at its +07:00 wall time and uses the local date in its name', () => {
    const p = plan(east, deadline);
    const entries = packEntries(p, midnight);
    expect(entries.map(e => e.date)).toEqual([...Array(5).fill('2026-11-17'), ...Array(5).fill('2026-11-18')]);
    const utcTimes = ['16T17:00Z', '16T22:00Z', '17T02:00Z', '17T10:00Z', '17T13:00Z'];
    for (const [i, utc] of utcTimes.entries()) {
      const { slot, sky } = PACK_SLOTS[i]!;
      const entry = entries[i]!;
      expect(entry.at).toBe(Date.parse(`2026-11-${utc}`));
      expect(entry.fileName).toBe(`BR_2026-11-17_${slot}.png`);
      expect(derive(p, entry.at).sky).toBe(sky);
    }
  });
});
