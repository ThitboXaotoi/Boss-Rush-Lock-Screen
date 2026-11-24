// Brief D tests: the guarded scene path never throws, whatever a plan or a stub does, and
// the fixture fallback still picks a sensible picture by sky.
import { fixturePlan, fixtureScenes } from '@boss-rush/core';
import { describe, expect, it } from 'vitest';
import { fallbackScene, sceneForPlan, sceneWords, skyForHour } from './scene';
import { epochForCivil } from './time';

const west = 'America/Los_Angeles';
const todayNoon = epochForCivil({ year: 2026, month: 11, day: 22 }, 12, 0, west);
const lateNight = epochForCivil({ year: 2026, month: 11, day: 25 }, 23, 0, west);

describe('sceneForPlan', () => {
  it('uses the real derive() when it works', () => {
    const { scene, fallback } = sceneForPlan(fixturePlan, todayNoon);
    expect(fallback).toBe(false);
    expect(scene.front).toMatchObject({ short: 'LOCK' }); // nearest deadline, Nov 23
  });

  it('returns a scene without throwing, whatever the plan contains', () => {
    for (const plan of [fixturePlan, { ...fixturePlan, bosses: [] }]) {
      for (const now of [todayNoon, lateNight]) {
        const { scene } = sceneForPlan(plan, now);
        expect(typeof scene.sky).toBe('string');
      }
    }
  });
});

describe('fixture fallback (the stub-era picture)', () => {
  it('picks the fixture scene by sky', () => {
    expect(fallbackScene(fixturePlan, lateNight)).toBe(fixtureScenes.awakeNight);
    expect(fallbackScene(fixturePlan, todayNoon)).toBe(fixtureScenes.farDay);
    const duskAlways = { ...fixturePlan, settings: { ...fixturePlan.settings, timeOfDay: false } };
    expect(fallbackScene(duskAlways, lateNight)).toBe(fixtureScenes.enragedDusk);
  });

  it('shows the empty screen when no deadline is visible', () => {
    expect(fallbackScene({ ...fixturePlan, bosses: [] }, todayNoon)).toBe(fixtureScenes.emptyNight);
  });

  it('maps hours to skies with the same start hours derive() uses', () => {
    expect(skyForHour(23)).toBe('night');
    expect(skyForHour(4)).toBe('night');
    expect(skyForHour(5)).toBe('dawn');
    expect(skyForHour(9)).toBe('day');
    expect(skyForHour(17)).toBe('dusk');
    expect(skyForHour(20)).toBe('night');
  });
});

describe('what changed, in words (spec 4)', () => {
  it('names sky, version, phase and the time left in one line', () => {
    const words = sceneWords(fixtureScenes.enragedDusk);
    expect(words).toContain('dusk');
    expect(words).toContain('light');
    expect(words).toContain('enraged');
    expect(words).toContain('5 days');
  });

  it('says so when no boss is visible', () => {
    expect(sceneWords(fixtureScenes.emptyNight)).toContain('no boss');
  });

  it('keeps a secret date secret: no countdown and no TIME share for a ??? boss', () => {
    const base = fixtureScenes.enragedDusk;
    const words = sceneWords({ ...base, front: { ...base.front!, short: '???', title: '???' } });
    expect(words).toContain('??? to the deadline');
    expect(words).toContain('TIME ???');
    expect(words).not.toMatch(/\d+ (day|h)/);
  });
});
