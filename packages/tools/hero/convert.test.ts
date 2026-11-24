import { neutrals } from '@boss-rush/core';
import { HERO_SIZE } from '../../render/src/art/types';
import { expect, it } from 'vitest';
import { poseRows } from './convert';

it('includes both ends of an even-width pose without shifting the common baseline', () => {
  const width = HERO_SIZE;
  const strip = (n: number) => {
    const rgba = new Uint8Array(width * 4);
    for (let x = 0; x < width; x++) {
      const colour = x >= n ? neutrals.white : x === n - 1 ? neutrals.gold : neutrals.ink;
      rgba.set([...colour, 255], x * 4);
    }
    return { width, height: 1, rgba };
  };
  const { idle, ready } = poseRows(strip(width / 2), strip(width));
  expect(ready.at(-1)).toBe('i'.repeat(width - 1) + 'g');
  expect(idle.at(-1)?.replaceAll('.', '')).toBe('i'.repeat(width / 2 - 1) + 'g');
});

it('honours transparent holes and keeps opaque white details on a small alpha-backed pose', () => {
  const pose = { width: 2, height: 2, rgba: Uint8Array.of(
    ...neutrals.white, 255, ...neutrals.ink, 0,
    ...neutrals.ink, 0, ...neutrals.maroon, 255,
  ) };
  const { idle } = poseRows(pose, pose);
  const half = HERO_SIZE / 2;
  expect(new Set(idle.slice(0, half))).toEqual(new Set(['w'.repeat(half) + '.'.repeat(half)]));
  expect(new Set(idle.slice(half))).toEqual(new Set(['.'.repeat(half) + 'm'.repeat(half)]));
});
