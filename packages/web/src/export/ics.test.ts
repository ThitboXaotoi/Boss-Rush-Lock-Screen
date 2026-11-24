import { fixturePlan } from '@boss-rush/core';
import type { Plan } from '@boss-rush/core';
import { describe, expect, it } from 'vitest';
import { buildIcs } from './ics';

const NOW = Date.parse('2026-11-22T10:00:00-08:00');

function planWithBosses(bosses: Plan['bosses']): Plan {
  return { ...fixturePlan, bosses };
}

describe('buildIcs', () => {
  it('uses CRLF line endings with no lone LF', () => {
    const ics = buildIcs(fixturePlan, NOW);
    expect(ics).toMatch(/\r\n$/);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
    expect(ics.replace(/\r\n/g, '')).not.toContain('\r');
  });

  it('folds long lines at 75 octets with a leading space on continuations', () => {
    const ics = buildIcs(
      planWithBosses([
        {
          id: 'long',
          title: 'A very long boss title that surely exceeds seventy-five octets when escaped',
          short: 'LONG',
          subject: 'test',
          deadline: '2026-11-23T23:59:00-08:00',
          sprite: 'boss_long',
          steps: [],
        },
      ]),
      NOW,
    );
    const lines = ics.split('\r\n');
    const encoder = new TextEncoder();
    for (const line of lines) {
      if (line === '') continue; // trailing CRLF
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    const summaryIndex = lines.findIndex((l) => l.startsWith('SUMMARY:'));
    expect(summaryIndex).toBeGreaterThanOrEqual(0);
    expect(lines[summaryIndex + 1]).toMatch(/^ /);
  });

  it('escapes commas, semicolons, backslashes and newlines', () => {
    const ics = buildIcs(
      planWithBosses([
        {
          id: 'esc',
          title: 'a,b;c\\d\ne',
          short: 'ESC',
          subject: 'test',
          deadline: '2026-11-23T23:59:00-08:00',
          sprite: 'boss_esc',
          steps: [],
        },
      ]),
      NOW,
    );
    expect(ics).toContain('SUMMARY:a\\,b\\;c\\\\d\\ne\r\n');
  });

  it('writes deadline times in UTC and skips bosses without a deadline', () => {
    const ics = buildIcs(
      planWithBosses([
        {
          id: 'lock',
          title: 'Countdown Lock Screen',
          short: 'LOCK',
          subject: 'design',
          deadline: '2026-11-23T23:59:00-08:00',
          sprite: 'boss_lock',
          steps: [],
        },
        {
          id: 'nodate',
          title: 'No Date Yet',
          short: 'NONE',
          subject: 'test',
          deadline: null,
          sprite: 'boss_nodate',
          steps: [],
        },
      ]),
      NOW,
    );
    // 23:59 at -08:00 is 07:59 the next day in UTC.
    expect(ics).toContain('DTSTART:20261124T075900Z');
    expect(ics).not.toContain('No Date Yet');
  });

  it('keeps stable UIDs across exports so re-importing updates', () => {
    const first = buildIcs(fixturePlan, NOW);
    const second = buildIcs(fixturePlan, NOW + 86_400_000);
    const uids = (ics: string) =>
      ics
        .split('\r\n')
        .filter((l) => l.startsWith('UID:'))
        .sort();
    const a = uids(first);
    expect(a.length).toBeGreaterThan(0);
    expect(uids(second)).toEqual(a);
    // Every UID is unique within the file.
    expect(new Set(a).size).toBe(a.length);
  });

  it('emits one all-day event per step', () => {
    const ics = buildIcs(fixturePlan, NOW);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261117');
    expect(ics).toContain('SUMMARY:LOCK: Grid on phone');
  });
});
