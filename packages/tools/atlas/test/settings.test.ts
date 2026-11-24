import { describe, expect, it } from 'vitest';
import { profiles } from '@boss-rush/core';
import {
  defaultSettings,
  defaultSizes,
  hexOf,
  nativeSides,
  normaliseSettings,
  parseHex,
  resolveVariant,
  settingsFragment,
  variantOptions,
} from '../src/import-settings';

describe('import settings', () => {
  it('reads and writes hex colours', () => {
    expect(parseHex('#FF00FF')).toEqual([255, 0, 255]);
    expect(parseHex('00ff00')).toEqual([0, 255, 0]);
    expect(hexOf([1, 2, 3])).toBe('#010203');
    expect(parseHex('magenta')).toBeNull();
    expect(parseHex('#fff')).toBeNull();
  });

  it('takes the sizes from the layout profiles', () => {
    const all = Object.values(profiles).filter((profile) => profile !== undefined);
    const sizes = defaultSizes();
    expect(sizes.boss).toBe(Math.max(...all.map((profile) => profile!.zones.boss.w)));
    expect(sizes.portrait).toBe(Math.max(...all.map((profile) => profile!.queue.portrait)));
    expect(sizes.backdrop.width).toBe(Math.max(...all.map((profile) => profile!.logical.width)));
    expect(sizes.backdrop.height).toBe(Math.max(...all.map((profile) => profile!.logical.height)));
  });

  it('lists every distinct native side, largest first, for the import to copy', () => {
    const all = Object.values(profiles).filter((profile) => profile !== undefined);
    const sides = nativeSides();
    expect(sides.boss).toEqual([...new Set(all.map((profile) => profile!.zones.boss.w))].sort((a, b) => b - a));
    expect(sides.portrait).toEqual(
      [...new Set(all.map((profile) => profile!.queue.portrait))].sort((a, b) => b - a),
    );
    expect(sides.boss[0]).toBe(defaultSizes().boss);
  });

  it('fills defaults and keeps only known fields', () => {
    const settings = normaliseSettings({
      version: 1,
      sprites: { boss_lock: { light: { mode: 'snap', palette: ['#ff00ff'], crop: { x: 1, y: 2, w: 3, h: 4 } } } },
      extra: 'dropped',
    });
    expect(settings.sprites.boss_lock?.light).toEqual({
      mode: 'snap',
      palette: ['#ff00ff'],
      crop: { x: 1, y: 2, w: 3, h: 4 },
    });
    expect('extra' in settings).toBe(false);
  });

  it('rejects a wrong version and malformed values', () => {
    expect(() => normaliseSettings({ version: 2, sprites: {} })).toThrow(/version/);
    expect(() => normaliseSettings({ version: 1 })).toThrow(/sprites/);
    expect(() =>
      normaliseSettings({ version: 1, sprites: { boss: { light: { palette: ['nope'] } } } }),
    ).toThrow(/palette/);
    expect(() =>
      normaliseSettings({ version: 1, sprites: { boss: { light: { crop: { x: 0, y: 0, w: 0, h: 1 } } } } }),
    ).toThrow(/w/);
  });

  it('resolves a variant with defaults', () => {
    expect(resolveVariant(undefined)).toEqual({
      colors: 8,
      mode: 'extract',
      palette: [],
      background: 'auto',
    });
  });

  it('builds importSprite options', () => {
    const options = variantOptions({ colors: 6, background: '#ff00ff' }, 32, 100);
    expect(options).toEqual({
      size: 32,
      background: [255, 0, 255],
      paletteMode: { kind: 'extract', colors: 6 },
      alphaThreshold: 100,
    });
    expect(() => variantOptions({ mode: 'snap' }, 32)).toThrow(/palette colour/);
  });

  it('writes a fragment in the import.json shape', () => {
    const fragment = settingsFragment('boss_lock', 'light', { colors: 4 });
    expect(fragment).toEqual({
      version: 1,
      sprites: { boss_lock: { light: { colors: 4 } } },
    });
    expect(defaultSettings(['b', 'a']).sprites).toEqual({ a: {}, b: {} });
  });
});
