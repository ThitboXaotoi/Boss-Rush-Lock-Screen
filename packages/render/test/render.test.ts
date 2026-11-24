import { Buffer } from 'node:buffer';
import { compact, fixtureScenes, glass, groundRamps, neutrals, skyRamps } from '@boss-rush/core';
import type { Profile, Rect, Rgb, SceneState, Sky } from '@boss-rush/core';
import { expect, it } from 'vitest';
import { emptyAtlas, hero, HERO_SIZE, placeholderAtlas, render, textWidth } from '../src';
import type { Atlas, Frame } from '../src';
import { GLYPH_H } from '../src/font5x7';
import { drawGround, drawSky, horizonRow, skyColourAt } from '../src/layers/ground';

function draw(profile: Profile, scene: SceneState, atlas = emptyAtlas): Frame {
  return render(scene, profile, atlas, { device: profile.logical });
}

function rgbaAt(frame: Frame, x: number, y: number): Uint8Array {
  const start = (y * frame.width + x) * 4;
  return frame.rgba.subarray(start, start + 4);
}

function paint(frame: Frame, x: number, y: number, colour: Rgb, alpha = 255): void {
  rgbaAt(frame, x, y).set([...colour, alpha]);
}

/** Pixels in `box` that show the plain backdrop (sky, ridge and land) and nothing drawn over it. */
function countSky(frame: Frame, box: Rect, profile: Profile, sky: Sky): number {
  const backdrop = { width: frame.width, height: frame.height, rgba: new Uint8Array(frame.rgba.length) };
  drawSky(backdrop, profile, sky);
  drawGround(backdrop, profile, sky);
  let count = 0;
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      const i = (y * frame.width + x) * 4;
      if ([0, 1, 2, 3].every(k => frame.rgba[i + k] === backdrop.rgba[i + k])) count++;
    }
  }
  return count;
}

function countColour(frame: Frame, box: Rect, [r, g, b]: Rgb): number {
  let count = 0;
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      const i = (y * frame.width + x) * 4;
      if (frame.rgba[i] === r && frame.rgba[i + 1] === g && frame.rgba[i + 2] === b && frame.rgba[i + 3] === 255) {
        count++;
      }
    }
  }
  return count;
}

it.each(Object.keys(skyRamps) as Sky[])('draws the %s sky in bands, the ground below, and keeps system zones plain', sky => {
  const frame = draw(compact, { ...fixtureScenes.farDay, sky });
  for (const key of ['statusBar', 'clock', 'widgets'] as const) {
    const zone = compact.zones[key];
    expect(countColour(frame, zone, skyRamps[sky][1]), key).toBe(zone.w * zone.h);
  }
  const lastRow = { x: 0, y: compact.logical.height - 1, w: compact.logical.width, h: 1 };
  const groundPixels = groundRamps[sky].reduce((n, c) => n + countColour(frame, lastRow, c), 0);
  expect(groundPixels).toBe(compact.logical.width);
  const { boss } = compact.zones;
  const b2 = boss.y + Math.floor(boss.h / 2);
  expect([...rgbaAt(frame, compact.logical.width - 1, b2)]).toEqual([...skyRamps[sky][2], 255]);
  expect(skyColourAt(compact, sky, b2)).toEqual(skyRamps[sky][2]);
  // The land starts at the horizon, just above the boss's feet, and runs to the bottom edge.
  const horizon = horizonRow(compact);
  expect(horizon).toBeLessThan(boss.y + boss.h);
  expect(horizon).toBeGreaterThan(boss.y + Math.floor((boss.h * 3) / 4));
  // Checked down the right-edge column, which no zone covers.
  const edge = { x: compact.logical.width - 1, y: horizon, w: 1, h: compact.logical.height - horizon };
  expect(groundRamps[sky].reduce((n, c) => n + countColour(frame, edge, c), 0)).toBe(edge.h);
});

it.each([compact, glass])('the $name empty screen is sky, ground and a whole-pixel hero', profile => {
  const empty = fixtureScenes.emptyNight;
  const frame = draw(profile, empty);
  const dangling = draw(profile, { ...fixtureScenes.enragedDusk, front: null, sky: empty.sky });
  expect(Buffer.from(frame.rgba).equals(dangling.rgba)).toBe(true);
  const { hero: zone } = profile.zones;

  const scale = Math.floor(Math.min(zone.w, zone.h) / HERO_SIZE);
  const x = zone.x + Math.floor((zone.w - HERO_SIZE * scale) / 2);
  const baseline = zone.y + zone.h;
  const lastInk = hero.rows.reduce((last, row, i) => [...row].some(ch => hero.colors[ch] != null) ? i : last, -1);
  expect(lastInk).toBeGreaterThanOrEqual(0);
  const expected = new Uint8Array(frame.rgba.length);
  const reference = { ...frame, rgba: expected };
  drawSky(reference, profile, empty.sky);
  drawGround(reference, profile, empty.sky);
  for (let row = 0; row <= lastInk; row++) {
    for (let col = 0; col < HERO_SIZE; col++) {
      const colour = hero.colors[hero.rows[row]![col]!];
      if (colour == null) continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          paint(reference, x + col * scale + sx, baseline - (lastInk + 1 - row) * scale + sy, neutrals[colour]);
        }
      }
    }
  }
  expect(Buffer.from(frame.rgba).equals(expected)).toBe(true);
});

it('centres atlas texels in a smaller profile without resampling or spilling out', () => {
  const source = compact.zones.boss;
  const zone = glass.zones.boss;
  const atlas: Atlas = {
    sprites: { boss_lock_final: { x: 0, y: 0, w: source.w, h: source.h } },
    width: source.w,
    height: source.h,
    rgba: new Uint8Array(source.w * source.h * 4),
  };
  const centreCropX = Math.ceil((source.w - zone.w) / 2);
  const centreCropY = Math.ceil((source.h - zone.h) / 2);
  paint(atlas, centreCropX, centreCropY, neutrals.gold);
  paint(atlas, centreCropX + 1, centreCropY, neutrals.warning);
  paint(atlas, centreCropX - 1, centreCropY, neutrals.white);
  const scene = { ...fixtureScenes.finalDawn, queue: [] };
  const frame = draw(glass, scene, atlas);
  expect([...rgbaAt(frame, zone.x, zone.y)]).toEqual([...neutrals.gold, 255]);
  expect([...rgbaAt(frame, zone.x + 1, zone.y)]).toEqual([...neutrals.warning, 255]);
  for (const x of [zone.x - 1, zone.x + 2]) {
    expect([...rgbaAt(frame, x, zone.y)]).toEqual([...skyRamps[scene.sky][1], 255]);
  }
});

it('uses an unfilled outline for missing boss and portrait sprites', () => {
  const frame = draw(compact, fixtureScenes.farDay);
  const { boss, queue } = compact.zones;
  for (const { x, y, w, h } of [
    boss,
    { ...queue, w: compact.queue.portrait, h: compact.queue.portrait },
  ]) {
    expect(countColour(frame, { x, y, w, h }, neutrals.fog)).toBe(2 * (w + h) - 4);
    expect(countSky(frame, { x: x + 1, y: y + 1, w: w - 2, h: h - 2 }, compact, 'day'))
      .toBe((w - 2) * (h - 2));
  }
});

it.each(Object.values(fixtureScenes).filter(scene => scene.front !== null))(
  'uses the phase colours and fills TIME only by the remaining fraction ($front.phase)',
  scene => {
    const { timer, namePlate } = compact.zones;
    const frame = draw(compact, scene);
    const phase = scene.front!.phase;
    const fill = phase === 'dormant' || phase === 'awake' ? neutrals.gold : neutrals.warning;
    const track = timer.w - 2 - textWidth('TIME') - 1;
    expect(countColour(frame, timer, fill)).toBe(Math.round(track * scene.timer) * (timer.h - 2));
    expect(countColour(frame, timer, neutrals.slate)).toBe((track - Math.round(track * scene.timer)) * (timer.h - 2));
    expect(countColour(frame, namePlate, neutrals.warning) > 0).toBe(phase === 'final' || phase === 'now');
  },
);

it('fits the third portrait, its label and overflow inside the glass queue', () => {
  const scene = fixtureScenes.enragedDusk;
  const frame = draw(glass, scene);
  const zone = glass.zones.queue;
  const { portrait, slotHeight, slots } = glass.queue;
  const thirdY = zone.y + (slots - 1) * slotHeight;
  const overflowY = zone.y + zone.h - GLYPH_H;
  expect(countColour(frame, { x: zone.x, y: thirdY, w: portrait, h: portrait }, neutrals.fog))
    .toBe(4 * portrait - 4);
  expect(countColour(frame, { ...zone, y: thirdY + portrait, h: overflowY - thirdY - portrait }, neutrals.white))
    .toBeGreaterThan(0);
  expect(countColour(frame, { ...zone, y: overflowY, h: GLYPH_H }, neutrals.fog)).toBeGreaterThan(0);
  expect(countSky(frame, { ...zone, y: zone.y + zone.h, h: 1 }, glass, scene.sky)).toBe(zone.w);
});

it('draws a widget border without painting over the sky inside it or other system zones', () => {
  const scene = fixtureScenes.enragedDusk;
  const frame = draw(compact, scene);
  const { statusBar, clock, widgets } = compact.zones;
  const { x, y, w, h } = widgets;
  expect([...rgbaAt(frame, x, y)]).toEqual([...neutrals.ink, 255]);
  expect([...rgbaAt(frame, x + 1, y + 1)]).toEqual([...neutrals.steel, 255]);
  const interior = { x: x + 2, y: y + 2, w: w - 4, h: h - 4 };
  const sky = skyRamps[scene.sky][1];
  for (const zone of [statusBar, clock, interior]) {
    expect(countColour(frame, zone, sky)).toBe(zone.w * zone.h);
  }
});

it('prefers the native sprite for a smaller boss zone over cropping the largest one', () => {
  const zone = glass.zones.boss;
  const atlas: Atlas = {
    sprites: {
      boss_lock_final: { x: 0, y: 0, w: 112, h: 112 },
      boss_lock_final_96: { x: 112, y: 0, w: 96, h: 96 },
    },
    width: 208,
    height: 112,
    rgba: new Uint8Array(208 * 112 * 4),
  };
  paint(atlas, 56, 56, neutrals.white); // centre of the 112 copy: where a centre crop would land
  for (let y = 0; y < 96; y++) {
    for (let x = 112; x < 208; x++) paint(atlas, x, y, neutrals.gold);
  }
  const scene = { ...fixtureScenes.finalDawn, queue: [] };
  const frame = draw(glass, scene, atlas);
  expect([...rgbaAt(frame, zone.x, zone.y)]).toEqual([...neutrals.gold, 255]);
  expect(countColour(frame, zone, neutrals.white)).toBe(0);
  expect(countColour(frame, zone, neutrals.gold)).toBe(zone.w * zone.h);
});

it('bobs only the front sprite in a six-frame cycle, by at most two logical pixels', () => {
  const scene = fixtureScenes.finalDawn;
  const atlas: Atlas = {
    sprites: { boss_lock_final: { x: 0, y: 0, w: 1, h: 1 } },
    width: 1,
    height: 1,
    rgba: new Uint8Array([...neutrals.gold, 255]),
  };
  const { x, y, w, h } = compact.zones.boss;
  const cx = x + Math.floor((w - 1) / 2);
  const cy = y + Math.floor((h - 1) / 2);
  const still = draw(compact, scene, atlas);
  const deltas = [0, -1, -2, -1, 1, 2];
  expect([...rgbaAt(still, cx, cy)]).toEqual([...neutrals.gold, 255]);
  for (let i = 0; i <= deltas.length; i++) {
    const animated = render(scene, compact, atlas, { device: compact.logical, idleFrame: i });
    const expected = { ...still, rgba: still.rgba.slice() };
    paint(expected, cx, cy, skyRamps[scene.sky][1]);
    paint(expected, cx, cy + deltas[i % deltas.length]!, neutrals.gold);
    expect(Buffer.from(animated.rgba).equals(expected.rgba), `idle frame ${i}`).toBe(true);
  }
});

it('packs deterministic placeholders whose silhouettes vary by name', () => {
  const names = ['boss_lock', 'boss_qsb', 'boss_math', 'boss_bioe'];
  const atlas = placeholderAtlas(compact, names);
  const reversed = placeholderAtlas(compact, [...names].reverse());
  expect(atlas.sprites).toEqual(reversed.sprites);
  expect(Buffer.from(atlas.rgba).equals(reversed.rgba)).toBe(true);
  expect(Object.keys(atlas.sprites)).toHaveLength(4 * names.length);
  const masks = names.map(name => {
    const { x, y, w, h } = atlas.sprites[`${name}_portrait`]!;
    const mask: number[] = [];
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) mask.push(rgbaAt(atlas, col, row)[3]!);
    }
    return mask.join();
  });
  expect(new Set(masks).size).toBe(names.length);
});
