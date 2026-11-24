import { describe, expect, it } from 'vitest';
import {
  allColors,
  fit,
  fixturePlan,
  fixtureScenes,
  packFileName,
  PLAN_VERSION,
  profiles,
  QUEUE_MAX,
  skyRamps,
} from '../src';

// Contract checks owned by the integrator. Brief A adds its own files next to this one.
describe('core contracts', () => {
  it('exports the plan version', () => {
    expect(PLAN_VERSION).toBe(1);
    expect(fixturePlan.version).toBe(PLAN_VERSION);
  });

  it('every profile keeps its zones inside the logical canvas and the bleed', () => {
    for (const profile of Object.values(profiles)) {
      const { width, height } = profile.logical;
      for (const [name, z] of Object.entries(profile.zones)) {
        expect(z.x >= 0 && z.y >= 0, `${profile.name}.${name} origin`).toBe(true);
        expect(z.x + z.w <= width, `${profile.name}.${name} right edge`).toBe(true);
        expect(z.y + z.h <= height, `${profile.name}.${name} bottom edge`).toBe(true);
        if (name !== 'statusBar' && name !== 'floor') {
          expect(z.x >= profile.bleed, `${profile.name}.${name} left bleed`).toBe(true);
          expect(z.x + z.w <= width - profile.bleed, `${profile.name}.${name} right bleed`).toBe(
            true,
          );
        }
      }
      expect(profile.zones.boss.w).toBe(profile.zones.boss.h);
      expect(profile.queue.slots).toBe(QUEUE_MAX);
      expect(profile.queue.slots * profile.queue.slotHeight <= profile.zones.queue.h).toBe(true);
    }
  });

  it('fit() picks a whole-number scale that covers the device', () => {
    const f = fit(profiles.compact!, { width: 1179, height: 2556 });
    expect(f).toEqual({ scale: 7, cropX: 40, cropY: 87 });
    expect(fit(profiles.compact!, { width: 180, height: 390 })).toEqual({
      scale: 1,
      cropX: 0,
      cropY: 0,
    });
  });

  it('palette colours are 8-bit RGB triples and sky ramps have equal length', () => {
    for (const rgb of allColors()) {
      expect(rgb).toHaveLength(3);
      for (const c of rgb) expect(Number.isInteger(c) && c >= 0 && c <= 255).toBe(true);
    }
    const lengths = Object.values(skyRamps).map((r) => r.length);
    expect(new Set(lengths).size).toBe(1);
  });

  it('fixture scenes respect the queue limit', () => {
    for (const scene of Object.values(fixtureScenes)) {
      expect(scene.queue.length <= QUEUE_MAX).toBe(true);
      expect(scene.timer >= 0 && scene.timer <= 1).toBe(true);
    }
  });

  it('pack file names follow the Shortcuts recipe', () => {
    expect(packFileName('2026-11-17', 'dawn')).toBe('BR_2026-11-17_dawn.png');
  });
});
