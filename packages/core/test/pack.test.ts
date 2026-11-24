import { describe, expect, it } from 'vitest';
import { derive, fixturePlan, packEntries, packFileName, PACK_SLOTS, type Plan } from '../src';

function plan(...deadlines: (string | null)[]): Plan {
  return {
    ...fixturePlan,
    timezone: 'America/Los_Angeles',
    settings: { ...fixturePlan.settings, timeOfDay: true },
    bosses: deadlines.map((deadline, i) => ({
      ...fixturePlan.bosses[0]!, id: `boss${i}`, deadline, steps: [],
    })),
  };
}

describe('packEntries', () => {
  it('includes all slots on both endpoint dates, in epoch order, with the sky advertised to Shortcuts', () => {
    // The latest instant is on the 21st in LA, even though another deadline says the 22nd.
    const p = plan(null, '2026-11-21T22:00:00-08:00', '2026-11-22T01:00:00+09:00');
    const entries = packEntries(p, Date.parse('2026-11-20T07:59:00Z')); // 19th, 23:59 in LA
    const dates = ['2026-11-19', '2026-11-20', '2026-11-21'];
    expect(entries).toHaveLength(15);
    for (const [i, entry] of entries.entries()) {
      const date = dates[Math.floor(i / 5)]!;
      const { hour, slot, sky } = PACK_SLOTS[i % 5]!;
      expect(entry).toEqual({
        date, slot, fileName: packFileName(date, slot),
        at: Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00-08:00`),
      });
      expect(derive(p, entry.at).sky).toBe(sky);
    }
  });

  it('uses only local midnight with time of day off, including across New Year', () => {
    const p = plan('2027-01-02T00:01:00-08:00');
    p.settings.timeOfDay = false;
    const entries = packEntries(p, Date.parse('2026-12-31T23:59:00-08:00'));
    expect(entries).toEqual(['2026-12-31', '2027-01-01', '2027-01-02'].map(date => ({
      date, slot: 'midnight', at: Date.parse(`${date}T08:00:00Z`), fileName: `BR_${date}_midnight.png`,
    })));
    for (const { at } of entries) expect(derive(p, at).sky).toBe('dusk');
  });

  it('returns no entries with no dated boss or after the last local date', () => {
    const from = Date.parse('2026-11-20T08:00:00Z');
    expect(packEntries(plan(null, null), from)).toEqual([]);
    expect(packEntries(plan(null, 'not a date'), from)).toEqual([]);
    expect(packEntries(plan('2026-11-20T07:59:00Z'), from)).toEqual([]);
  });

  it('includes the entire last day even when its deadline was earlier that morning', () => {
    const entries = packEntries(plan('2026-11-20T08:01:00Z'), Date.parse('2026-11-21T07:59:00Z'));
    expect(entries.map(e => e.fileName)).toEqual([
      'BR_2026-11-20_midnight.png', 'BR_2026-11-20_dawn.png', 'BR_2026-11-20_day.png',
      'BR_2026-11-20_dusk.png', 'BR_2026-11-20_night.png',
    ]);
  });
});
