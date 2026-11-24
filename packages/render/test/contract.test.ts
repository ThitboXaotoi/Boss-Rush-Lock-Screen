import { fixtureScenes, profiles } from '@boss-rush/core';
import { describe, expect, it } from 'vitest';
import { decodePng, emptyAtlas, encodePng, render } from '../src';

// Contract checks owned by the integrator. Brief B adds golden tests next to this file.
const device = { width: 1179, height: 2556 };

describe('render contract', () => {
  it('returns an opaque frame of exactly the device size for every fixture scene', () => {
    for (const scene of Object.values(fixtureScenes)) {
      const frame = render(scene, profiles.compact!, emptyAtlas, { device });
      expect(frame.width).toBe(device.width);
      expect(frame.height).toBe(device.height);
      expect(frame.rgba.length).toBe(device.width * device.height * 4);
      for (let i = 3; i < frame.rgba.length; i += 4 * 9973) expect(frame.rgba[i]).toBe(255);
    }
  });

  it('is deterministic and survives a PNG round trip', () => {
    const small = { width: 180, height: 390 };
    const a = render(fixtureScenes.enragedDusk, profiles.compact!, emptyAtlas, { device: small });
    const b = render(fixtureScenes.enragedDusk, profiles.compact!, emptyAtlas, { device: small });
    const pngA = encodePng(a);
    expect(Buffer.from(pngA).equals(Buffer.from(encodePng(b)))).toBe(true);
    expect(Buffer.from(decodePng(pngA).rgba).equals(Buffer.from(a.rgba))).toBe(true);
  });
});
