import type { RgbaImage } from '../src';

export type Colour = readonly [number, number, number];

export const MAGENTA: Colour = [255, 0, 255];

export function image(width: number, height: number, colour: Colour = MAGENTA): RgbaImage {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = colour[0];
    rgba[i + 1] = colour[1];
    rgba[i + 2] = colour[2];
    rgba[i + 3] = 255;
  }
  return { width, height, rgba };
}

export function fill(
  target: RgbaImage,
  x: number,
  y: number,
  w: number,
  h: number,
  colour: Colour,
  alpha = 255,
): void {
  for (let row = y; row < y + h; row++) {
    for (let column = x; column < x + w; column++) {
      const i = (row * target.width + column) * 4;
      target.rgba[i] = colour[0];
      target.rgba[i + 1] = colour[1];
      target.rgba[i + 2] = colour[2];
      target.rgba[i + 3] = alpha;
    }
  }
}

export function pixel(target: RgbaImage, x: number, y: number): [number, number, number, number] {
  const i = (y * target.width + x) * 4;
  return [target.rgba[i]!, target.rgba[i + 1]!, target.rgba[i + 2]!, target.rgba[i + 3]!];
}

export function opaqueColours(target: RgbaImage): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < target.rgba.length; i += 4) {
    if (target.rgba[i + 3] === 255) {
      set.add(`${target.rgba[i]},${target.rgba[i + 1]},${target.rgba[i + 2]}`);
    }
  }
  return set;
}

export function hasAlphaOtherThan01(target: RgbaImage): boolean {
  for (let i = 3; i < target.rgba.length; i += 4) {
    if (target.rgba[i] !== 0 && target.rgba[i] !== 255) return true;
  }
  return false;
}
