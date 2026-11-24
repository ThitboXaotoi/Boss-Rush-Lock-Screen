import { describe, expect, it } from 'vitest';
import { squareCrop } from './crop';

const image = { width: 100, height: 100 };

describe('squareCrop', () => {
  it('follows the larger drag dimension from the anchor corner', () => {
    expect(squareCrop(image, 10, 10, 30, 25)).toEqual({ x: 10, y: 10, w: 20, h: 20 });
    expect(squareCrop(image, 40, 40, 20, 20)).toEqual({ x: 20, y: 20, w: 20, h: 20 });
  });

  it('keeps a minimum box for a tiny drag', () => {
    expect(squareCrop(image, 50, 50, 51, 51)).toEqual({ x: 50, y: 50, w: 8, h: 8 });
  });

  it('stays inside the picture', () => {
    expect(squareCrop(image, 90, 10, 120, 30)).toEqual({ x: 70, y: 10, w: 30, h: 30 });
    expect(squareCrop({ width: 4, height: 100 }, 0, 0, 4, 50)).toEqual({ x: 0, y: 0, w: 4, h: 4 });
  });
});
