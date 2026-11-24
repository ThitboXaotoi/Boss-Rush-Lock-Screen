import type { Rgb } from '@boss-rush/core';
import { glyphs } from './art/font';

export const GLYPH_W = 5;
export const GLYPH_H = 7;
export const CELL_W = GLYPH_W + 1;

/** Layout width, including the final cell's blank column. */
export function textWidth(text: string): number {
  return [...text].length * CELL_W;
}

/** Draw opaque glyph pixels, clipped to a row-major RGBA buffer (stride in pixels). */
export function drawText(
  buffer: Uint8Array,
  stride: number,
  x: number,
  y: number,
  text: string,
  colour: Rgb,
): void {
  const height = Math.floor(buffer.length / (stride * 4));
  for (const ch of text) {
    const rows = glyphs[ch] ?? glyphs['?'];
    for (let row = 0; row < GLYPH_H; row++) {
      const py = y + row;
      if (py < 0 || py >= height) continue;
      for (let col = 0; col < GLYPH_W; col++) {
        const px = x + col;
        if (px < 0 || px >= stride || rows?.[row]?.[col] !== '#') continue;
        const i = (py * stride + px) * 4;
        buffer[i] = colour[0];
        buffer[i + 1] = colour[1];
        buffer[i + 2] = colour[2];
        buffer[i + 3] = 255;
      }
    }
    x += CELL_W;
  }
}
