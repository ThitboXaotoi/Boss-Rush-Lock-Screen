import { fixturePlan } from '@boss-rush/core';
import { encodePng } from '@boss-rush/render';
import type { Frame } from '@boss-rush/render';
import { describe, expect, it } from 'vitest';
import { composeCover, COVER_HEIGHT, COVER_PHONE, COVER_WIDTH, coverScenes } from './cover';

function solid(w: number, h: number, r: number, g: number, b: number): Frame {
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
    rgba[i + 3] = 255;
  }
  return { width: w, height: h, rgba };
}

const panels = (): [Frame, Frame, Frame] => [
  solid(COVER_PHONE.width, COVER_PHONE.height, 255, 0, 0),
  solid(COVER_PHONE.width, COVER_PHONE.height, 0, 255, 0),
  solid(COVER_PHONE.width, COVER_PHONE.height, 0, 0, 255),
];

describe('composeCover', () => {
  it('is 2400 x 1600', () => {
    const cover = composeCover(panels());
    expect(cover.width).toBe(2400);
    expect(cover.width).toBe(COVER_WIDTH);
    expect(cover.height).toBe(1600);
    expect(cover.height).toBe(COVER_HEIGHT);
    expect(cover.rgba.length).toBe(COVER_WIDTH * COVER_HEIGHT * 4);
  });

  it('produces the same bytes twice', () => {
    const a = encodePng(composeCover(panels()));
    const b = encodePng(composeCover(panels()));
    expect(a).toEqual(b);
  });

  it('places the three panels left to right with background between them', () => {
    const cover = composeCover(panels());
    const pixel = (x: number, y: number) => {
      const i = (y * cover.width + x) * 4;
      return [cover.rgba[i], cover.rgba[i + 1], cover.rgba[i + 2]];
    };
    // Inside each phone.
    expect(pixel(120 + 10, 800)).toEqual([255, 0, 0]);
    expect(pixel(120 + 640 + 120 + 10, 800)).toEqual([0, 255, 0]);
    expect(pixel(120 + 2 * (640 + 120) + 10, 800)).toEqual([0, 0, 255]);
    // In the gaps: the plain background, not a panel colour.
    expect(pixel(60, 800)).toEqual(pixel(120 + 640 + 60, 800));
    expect(pixel(60, 800)).not.toEqual([255, 0, 0]);
  });
});

describe('coverScenes', () => {
  const NOW = Date.parse('2026-11-22T10:00:00-08:00');

  it('shows the same boss as light, dark and final', () => {
    const [light, dark, final] = coverScenes(fixturePlan, NOW);
    expect(light.front?.variant).toBe('light');
    expect(light.sky).toBe('day');
    expect(dark.front?.variant).toBe('dark');
    expect(dark.sky).toBe('night');
    expect(final.front?.variant).toBe('final');
    expect(light.front?.id).toBe(dark.front?.id);
    expect(light.front?.id).toBe(final.front?.id);
  });

  it('does not depend on when it is built', () => {
    const a = coverScenes(fixturePlan, NOW);
    const b = coverScenes(fixturePlan, NOW + 36_000_000);
    expect(a).toEqual(b);
  });
});
