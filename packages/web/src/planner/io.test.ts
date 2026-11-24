import { fixturePlan } from '@boss-rush/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { exportPlanJson, formatRemindersList, parsePlanJson } from './io';

// Provide browser globals in Node test environment so store.ts can be loaded safely.
if (typeof globalThis.location === 'undefined') {
  (globalThis as unknown as { location: { origin: string; pathname: string; hash: string } }).location = {
    origin: 'http://localhost',
    pathname: '/',
    hash: '',
  };
}
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };
}

describe('planner I/O', () => {
  let encodePlan: typeof import('../store').encodePlan;
  let decodePlan: typeof import('../store').decodePlan;

  beforeAll(async () => {
    const store = await import('../store');
    encodePlan = store.encodePlan;
    decodePlan = store.decodePlan;
  });

  it('loads a valid plan file correctly', () => {
    const json = JSON.stringify(fixturePlan);
    const result = parsePlanJson(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.version).toBe(1);
      expect(result.plan.bosses).toHaveLength(fixturePlan.bosses.length);
    }
  });

  it('rejects a file that is not valid JSON with a clear message', () => {
    const result = parsePlanJson('{ broken json');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/valid JSON/i);
    }
  });

  it('rejects empty content with a clear message', () => {
    const result = parsePlanJson('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/empty/i);
    }
  });

  it('rejects a file that is not a plan with a message', () => {
    const notAPlan = JSON.stringify({ hello: 'world' });
    const result = parsePlanJson(notAPlan);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/version/i);
    }

    const wrongVersion = JSON.stringify({ version: 99, bosses: [], settings: {} });
    const result2 = parsePlanJson(wrongVersion);
    expect(result2.ok).toBe(false);
    if (!result2.ok) {
      expect(result2.error).toMatch(/version/i);
    }

    const missingBosses = JSON.stringify({ version: 1, settings: {} });
    const result3 = parsePlanJson(missingBosses);
    expect(result3.ok).toBe(false);
    if (!result3.ok) {
      expect(result3.error).toMatch(/bosses/i);
    }
  });

  it('a plan exported and re-imported is identical', () => {
    const exported = exportPlanJson(fixturePlan);
    const reimported = parsePlanJson(exported);
    expect(reimported.ok).toBe(true);
    if (reimported.ok) {
      expect(reimported.plan).toEqual(fixturePlan);
    }
  });

  it('a plan sent through encodePlan and decodePlan is identical', () => {
    const encoded = encodePlan(fixturePlan);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
    const decoded = decodePlan(encoded);
    expect(decoded).toEqual(fixturePlan);
  });

  it('formats the Reminders list with all bosses and steps', () => {
    const list = formatRemindersList(fixturePlan);
    expect(list).toContain('Boss Rush — Reminders Schedule');
    expect(list).toContain('[LOCK] Countdown Lock Screen');
    expect(list).toContain('[ ] 2026-11-17 Grid on phone');
    expect(list).toContain('[QSB] QSB 278');
  });
});
