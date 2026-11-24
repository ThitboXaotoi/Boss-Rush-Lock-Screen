import { neutrals, skyRamps } from '@boss-rush/core';
import type { Rect, Rgb, Sky } from '@boss-rush/core';
import type { Atlas, Frame } from '../render';
import { outlineBox } from './pixels';

const rgbKey = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;

function blit(
  frame: Frame,
  atlas: Atlas,
  source: Rect,
  x: number,
  y: number,
  clip: Rect,
  recolour?: ReadonlyMap<number, Rgb>,
): void {
  const left = Math.max(0, clip.x, x);
  const top = Math.max(0, clip.y, y);
  const right = Math.min(frame.width, clip.x + clip.w, x + source.w);
  const bottom = Math.min(frame.height, clip.y + clip.h, y + source.h);

  for (let dy = top; dy < bottom; dy++) {
    let src = ((source.y + dy - y) * atlas.width + source.x + left - x) * 4;
    let dst = (dy * frame.width + left) * 4;
    for (let dx = left; dx < right; dx++, src += 4, dst += 4) {
      if (atlas.rgba[src + 3] !== 255) continue;
      const r = atlas.rgba[src]!;
      const g = atlas.rgba[src + 1]!;
      const b = atlas.rgba[src + 2]!;
      const colour = recolour?.get(rgbKey(r, g, b));
      frame.rgba[dst] = colour?.[0] ?? r;
      frame.rgba[dst + 1] = colour?.[1] ?? g;
      frame.rgba[dst + 2] = colour?.[2] ?? b;
      frame.rgba[dst + 3] = 255;
    }
  }
}

export function drawBackdrop(frame: Frame, atlas: Atlas, sky: Sky): void {
  const backdrop = atlas.sprites.backdrop;
  if (!backdrop) return;
  const recolour = sky === 'day' ? undefined : new Map(
    skyRamps.day.map(([r, g, b], i) => [rgbKey(r, g, b), skyRamps[sky][i]!]),
  );
  blit(frame, atlas, backdrop, 0, 0, { x: 0, y: 0, w: frame.width, h: frame.height }, recolour);
}

/** A sprite written natively for one zone side by the art import: `<key>_<side>`. */
const nativeKey = (key: string, side: number): string => `${key}_${side}`;

/**
 * Atlas texels are already logical pixels. Centre and clip, without resampling.
 * A native copy for this zone’s side is preferred, so a smaller profile keeps the whole
 * picture instead of cropping the largest one; the plain key is the fallback.
 */
export function drawSprite(frame: Frame, atlas: Atlas, key: string, zone: Rect, offsetY = 0): void {
  const sprite = atlas.sprites[nativeKey(key, Math.min(zone.w, zone.h))] ?? atlas.sprites[key];
  if (!sprite) {
    outlineBox(frame, zone, neutrals.fog);
    return;
  }
  const x = zone.x + Math.floor((zone.w - sprite.w) / 2);
  const y = zone.y + Math.floor((zone.h - sprite.h) / 2) + offsetY;
  blit(frame, atlas, sprite, x, y, zone);
}
