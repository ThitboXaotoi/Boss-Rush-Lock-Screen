import { compact, fixtureScenes, glass, neutrals } from '@boss-rush/core';
import type { BossState, Profile } from '@boss-rush/core';
import { expect, it } from 'vitest';
import { render } from '../src';
import type { Atlas } from '../src';

// Single-texel silhouettes distinguish all three atlas choices in the actual rendered frame.
const finalTexel = { x: 0, y: 0, w: 1, h: 1 };
const atlas: Atlas = {
  width: 3, height: 1,
  rgba: new Uint8Array([...neutrals.fog, 255, ...neutrals.warning, 255, ...neutrals.gold, 255]),
  sprites: {
    boss_lock_final: finalTexel,
    boss_lock_monster: { ...finalTexel, x: 1 },
    [`boss_lock_monster_${glass.zones.boss.w}`]: { ...finalTexel, x: 2 },
  },
};
const now = fixtureScenes.nowDay.front;

function frontPixel(front: BossState, profile: Profile, art: Atlas): number[] {
  const frame = render({ ...fixtureScenes.nowDay, front }, profile, art, { device: profile.logical });
  const { x, y, w, h } = profile.zones.boss;
  const p = ((y + Math.floor((h - 1) / 2)) * frame.width + x + Math.floor((w - 1) / 2)) * 4;
  return [...frame.rgba.subarray(p, p + 4)];
}

it('shows the optional picture in the last 24 hours for any boss, using the native profile copy', () => {
  expect(frontPixel({ ...now, hoursLeft: 23 }, compact, atlas)).toEqual([...neutrals.warning, 255]);
  expect(frontPixel({ ...now, short: '???', hoursLeft: 0 }, glass, atlas)).toEqual([...neutrals.gold, 255]);
});

it('keeps Final before the last day or when the boss has no monster', () => {
  expect(frontPixel(fixtureScenes.finalDawn.front, compact, atlas)).toEqual([...neutrals.fog, 255]);
  expect(frontPixel({ ...now, hoursLeft: 24 }, compact, atlas)).toEqual([...neutrals.fog, 255]);
  const other = { ...now, sprite: 'boss_other' };
  const art = { ...atlas, sprites: { ...atlas.sprites, boss_other_final: finalTexel } };
  expect(frontPixel(other, glass, art)).toEqual([...neutrals.fog, 255]);
});
