import { fixturePlan, fixtureScenes } from '@boss-rush/core';
import { decodePng, emptyAtlas, renderGrid } from '@boss-rush/render';
import { describe, expect, it } from 'vitest';
import { renderScenePng, resolveProfile } from './picture';

describe('resolveProfile', () => {
  it('returns the plan profile without fallback', () => {
    const { profile, fellBack } = resolveProfile(fixturePlan);
    expect(profile.name).toBe('compact');
    expect(fellBack).toBe(false);
  });

  it('falls back to compact for a profile that is not built yet', () => {
    const { profile, fellBack } = resolveProfile({
      ...fixturePlan,
      settings: { ...fixturePlan.settings, profile: 'ipad' },
    });
    expect(profile.name).toBe('compact');
    expect(fellBack).toBe(true);
  });
});

describe('renderScenePng', () => {
  it('renders at exactly the device size, frame and PNG bytes alike', () => {
    const { profile } = resolveProfile(fixturePlan);
    const device = fixturePlan.settings.device;
    const { png, frame } = renderScenePng(fixtureScenes.farDay, profile, emptyAtlas, device);
    expect(frame.width).toBe(device.width);
    expect(frame.height).toBe(device.height);
    const decoded = decodePng(png);
    expect(decoded.width).toBe(device.width);
    expect(decoded.height).toBe(device.height);
  });

  it('renders the grid at an arbitrary device size', () => {
    const { profile } = resolveProfile(fixturePlan);
    const frame = renderGrid(profile, { width: 500, height: 1000 });
    expect(frame.width).toBe(500);
    expect(frame.height).toBe(1000);
  });
});
