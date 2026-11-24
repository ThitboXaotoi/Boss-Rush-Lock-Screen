import { Buffer } from 'node:buffer';
import { compact, fit, fixturePlan, glass, neutrals } from '@boss-rush/core';
import type { Rect, Rgb } from '@boss-rush/core';
import { expect, it } from 'vitest';
import { drawText, renderGrid, textWidth } from '../src';
import type { Frame } from '../src';
import { GLYPH_H } from '../src/font5x7';

function hasTag(frame: Frame, area: Rect, text: string, ink: Rgb): boolean {
  const w = textWidth(text);
  const expected = Buffer.alloc(w * GLYPH_H * 4);
  for (let i = 0; i < expected.length; i += 4) expected.set([...neutrals.black, 255], i);
  drawText(expected, w, 0, 0, text, ink);
  const rows = Array.from({ length: GLYPH_H }, (_, i) => expected.subarray(i * w * 4, (i + 1) * w * 4));

  const image = Buffer.from(frame.rgba.buffer, frame.rgba.byteOffset, frame.rgba.length);
  for (let y = area.y; y <= area.y + area.h - GLYPH_H; y++) {
    for (let x = area.x; x <= area.x + area.w - w; x++) {
      const start = (y * frame.width + x) * 4;
      const matches = rows.every((row, i) => {
        const p = start + i * frame.width * 4;
        return row.equals(image.subarray(p, p + w * 4));
      });
      if (matches) return true;
    }
  }
  return false;
}

function pixel(frame: Frame, x: number, y: number): number[] {
  const i = (y * frame.width + x) * 4;
  return [...frame.rgba.subarray(i, i + 4)];
}

it('keeps the grid lines and shows numbers every fifty pixels and ticks every ten', () => {
  const frame = renderGrid(compact, compact.logical);
  const axisLabelTop = frame.height - 15 - GLYPH_H;
  for (let x = 0; x < frame.width; x += 50) {
    const left = Math.max(0, x - 15);
    const area = { x: left, y: axisLabelTop, w: Math.min(30, frame.width - left), h: GLYPH_H };
    expect(hasTag(frame, area, String(x), neutrals.white), `x=${x}`).toBe(true);
    expect(pixel(frame, x, axisLabelTop - 2)).toEqual([...neutrals.white, 255]);
  }
  for (let y = 0; y < frame.height; y += 50) {
    const top = Math.max(0, y - 5);
    expect(hasTag(frame, { x: 1, y: top, w: 26, h: 13 }, String(y), neutrals.white), `y=${y}`).toBe(true);
    expect(pixel(frame, 2, y)).toEqual([...neutrals.white, 255]);
  }
  expect(pixel(frame, 10, axisLabelTop - 2)).toEqual([...neutrals.fog, 255]);
  expect(pixel(frame, 1, 40)).toEqual([...neutrals.fog, 255]);
  expect(pixel(frame, 50, 25)).toEqual([...neutrals.fog, 255]);
  expect(pixel(frame, 20, 25)).toEqual([...neutrals.slate, 255]);
  expect(pixel(frame, 1, 25)).toEqual([...neutrals.warning, 255]);
});

const zoneLabels = {
  statusBar: 'STATUS BAR',
  clock: 'CLOCK',
  widgets: 'WIDGETS',
  queue: 'QUEUE',
  boss: 'BOSS',
  namePlate: 'NAME PLATE',
  timer: 'TIMER',
  hero: 'HERO',
  nextLine: 'NEXT LINE',
  floor: 'FLOOR',
} as const;

it.each([compact, glass])('labels every $name zone inside its outline', profile => {
  const frame = renderGrid(profile, profile.logical);
  for (const zone of Object.keys(zoneLabels) as (keyof typeof zoneLabels)[]) {
    const { x, y, w, h } = profile.zones[zone];
    const top = Math.max(y + 1, 15);
    const area = { x: x + 1, y: top, w: w - 2, h: y + h - 1 - top };
    expect(hasTag(frame, area, zoneLabels[zone], neutrals.gold), zone).toBe(true);
  }
});

it.each([compact, glass])('scales and crops the $name grid to the device, keeping axis labels visible', profile => {
  const device = fixturePlan.settings.device;
  const frame = renderGrid(profile, device);
  expect(frame.width).toBe(device.width);
  expect(frame.height).toBe(device.height);
  expect(frame.rgba).toHaveLength(device.width * device.height * 4);

  // Reconstruct the fully visible logical region, taking the first pixel of each scaled block.
  const { scale, cropX, cropY } = fit(profile, device);
  const logical: Frame = { ...profile.logical, rgba: new Uint8Array(profile.logical.width * profile.logical.height * 4) };
  for (let y = Math.ceil(cropY / scale); y < Math.floor((cropY + device.height) / scale); y++) {
    for (let x = Math.ceil(cropX / scale); x < Math.floor((cropX + device.width) / scale); x++) {
      logical.rgba.set(pixel(frame, x * scale - cropX, y * scale - cropY), (y * logical.width + x) * 4);
    }
  }
  expect(hasTag(logical, { x: 80, y: logical.height - 15 - GLYPH_H, w: 40, h: GLYPH_H }, '100', neutrals.white))
    .toBe(true);
  expect(hasTag(logical, { x: 0, y: 195, w: 45, h: 13 }, '200', neutrals.white)).toBe(true);
});
