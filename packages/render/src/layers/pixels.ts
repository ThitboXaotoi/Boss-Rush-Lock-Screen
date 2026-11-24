import type { Rect, Rgb } from '@boss-rush/core';
import type { Frame } from '../render';

export function fillBox(frame: Frame, box: Rect, colour: Rgb): void {
  const { width, height, rgba } = frame;
  const left = Math.max(0, box.x);
  const right = Math.min(width, box.x + box.w);
  const bottom = Math.min(height, box.y + box.h);
  for (let y = Math.max(0, box.y); y < bottom; y++) {
    let p = (y * width + left) * 4;
    for (let x = left; x < right; x++, p += 4) {
      rgba[p] = colour[0];
      rgba[p + 1] = colour[1];
      rgba[p + 2] = colour[2];
      rgba[p + 3] = 255;
    }
  }
}

export function outlineBox(frame: Frame, { x, y, w, h }: Rect, colour: Rgb): void {
  if (w <= 0 || h <= 0) return;
  fillBox(frame, { x, y, w, h: 1 }, colour);
  fillBox(frame, { x, y: y + h - 1, w, h: 1 }, colour);
  fillBox(frame, { x, y, w: 1, h }, colour);
  fillBox(frame, { x: x + w - 1, y, w: 1, h }, colour);
}
