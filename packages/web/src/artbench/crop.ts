// Crop-box geometry for the art bench. Square, because `importSprite` re-centres a square
// inside a rectangular crop anyway. Pure, so it is testable without a DOM.
import type { Rect } from '@boss-rush/core';

export function squareCrop(
  image: { width: number; height: number },
  ax: number,
  ay: number,
  bx: number,
  by: number,
): Rect {
  const limit = Math.max(1, Math.min(image.width, image.height));
  const side = Math.min(limit, Math.max(8, Math.abs(bx - ax), Math.abs(by - ay)));
  const x = Math.max(0, Math.min(image.width - side, bx >= ax ? ax : ax - side));
  const y = Math.max(0, Math.min(image.height - side, by >= ay ? ay : ay - side));
  return { x, y, w: side, h: side };
}
