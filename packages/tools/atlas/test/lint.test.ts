import { describe, expect, it } from 'vitest';
import type { Rgb } from '@boss-rush/core';
import { lintSprites } from '../src/lint';
import type { LintEntry } from '../src/lint';
import { image } from './fixtures';

const PALETTE: Rgb[] = [
  [10, 20, 30],
  [200, 100, 50],
];

function entries(keys: string[]): LintEntry[] {
  return keys.map((key) => ({ key, image: image(1, 1, [10, 20, 30]) }));
}

describe('lintSprites', () => {
  it('passes a clean sprite', () => {
    const report = lintSprites(entries(['boss_a_light']), PALETTE);
    expect(report.issues).toEqual([]);
  });

  it('fails on one off-palette pixel', () => {
    const sprite = image(2, 2, [10, 20, 30]);
    sprite.rgba.set([1, 2, 3, 255], 0);
    const report = lintSprites([{ key: 'boss_a_light', image: sprite }], PALETTE);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatch(/outside the palette/);
    expect(report.issues[0]).toMatch(/#010203 at 0,0/);
  });

  it('fails on one half-transparent pixel', () => {
    const sprite = image(2, 2, [10, 20, 30]);
    sprite.rgba[3] = 128;
    const report = lintSprites([{ key: 'boss_a_light', image: sprite }], PALETTE);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatch(/partly transparent/);
    expect(report.issues[0]).toMatch(/alpha 128/);
  });

  it('reports complete and incomplete bosses', () => {
    const report = lintSprites(
      entries(['boss_a_light', 'boss_a_dark', 'boss_a_final', 'boss_a_portrait', 'boss_b_light']),
      PALETTE,
    );
    expect(report.complete).toEqual(['boss_a']);
    expect(report.incomplete).toEqual([{ sprite: 'boss_b', missing: ['dark', 'final', 'portrait'] }]);
    expect(report.issues).toEqual([]);
  });

  it('checks monster pixels but never uses the monster to satisfy a required variant', () => {
    const plain = ['light', 'dark', 'final', 'portrait'];
    const sprites = entries([
      ...plain.map(v => `boss_a_${v}`),
      ...plain.map(v => `boss_b_${v}`), 'boss_b_monster',
      'boss_c_light', 'boss_c_dark', 'boss_c_portrait', 'boss_c_monster',
    ]);
    sprites.find(s => s.key === 'boss_b_monster')!.image.rgba[3] = 128;
    const report = lintSprites(sprites, PALETTE);
    expect(report.complete).toEqual(['boss_a', 'boss_b']);
    expect(report.incomplete).toEqual([{ sprite: 'boss_c', missing: ['final'] }]);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatch(/boss_b_monster:.*partly transparent/);
  });
});
