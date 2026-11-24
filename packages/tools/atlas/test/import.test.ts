import { describe, expect, it } from 'vitest';
import { encodePng } from '@boss-rush/render';
import { importSprite } from '../src';
import type { ImportOptions, RgbaImage } from '../src';
import { MAGENTA, fill, hasAlphaOtherThan01, image, opaqueColours, pixel } from './fixtures';

const RED = [255, 0, 0] as const;
const BLUE = [0, 0, 255] as const;
const WHITE = [255, 255, 255] as const;

function blocks(): RgbaImage {
  const source = image(448, 448, MAGENTA);
  fill(source, 64, 64, 256, 128, RED);
  fill(source, 64, 64, 4, 4, BLUE);
  return source;
}

function gradient(): RgbaImage {
  const source = image(64, 64, MAGENTA);
  for (let y = 16; y < 48; y++) {
    for (let x = 16; x < 48; x++) {
      const i = (y * 64 + x) * 4;
      source.rgba[i] = (x - 16) * 8;
      source.rgba[i + 1] = 0;
      source.rgba[i + 2] = 255 - (x - 16) * 8;
      source.rgba[i + 3] = 255;
    }
  }
  fill(source, 8, 16, 8, 32, RED, 64);
  fill(source, 56, 16, 8, 32, [0, 255, 0], 255);
  return source;
}

const extract = (colors: number): ImportOptions['paletteMode'] => ({ kind: 'extract', colors });

describe('importSprite: flat blocks', () => {
  it('gives the exact expected 112 x 112 sprite in extract mode', () => {
    const result = importSprite(blocks(), {
      size: 112,
      background: 'auto',
      paletteMode: extract(8),
      alphaThreshold: 128,
    });
    expect(result.image.width).toBe(112);
    expect(result.image.height).toBe(112);
    expect(pixel(result.image, 16, 16)).toEqual([0, 0, 255, 255]);
    expect(pixel(result.image, 17, 16)).toEqual([255, 0, 0, 255]);
    expect(pixel(result.image, 79, 47)).toEqual([255, 0, 0, 255]);
    expect(pixel(result.image, 80, 47)).toEqual([0, 0, 0, 0]);
    expect(pixel(result.image, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(opaqueColours(result.image).size).toBe(2);
    // Darkest first: blue (luminance 29070) before red (76245).
    expect(result.colors).toEqual([
      [0, 0, 255],
      [255, 0, 0],
    ]);
  });

  it('gives the same sprite in snap mode', () => {
    const result = importSprite(blocks(), {
      size: 112,
      background: 'auto',
      paletteMode: { kind: 'snap', palette: [RED, BLUE, WHITE] },
      alphaThreshold: 128,
    });
    expect(pixel(result.image, 16, 16)).toEqual([0, 0, 255, 255]);
    expect(pixel(result.image, 17, 16)).toEqual([255, 0, 0, 255]);
    expect(pixel(result.image, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(result.colors).toEqual([
      [0, 0, 255],
      [255, 0, 0],
    ]);
  });

  it('warns when fewer colours exist than were requested', () => {
    const result = importSprite(blocks(), {
      size: 112,
      background: 'auto',
      paletteMode: extract(8),
      alphaThreshold: 128,
    });
    expect(result.warnings.some((warning) => /only 2 colours/.test(warning))).toBe(true);
  });
});

describe('importSprite: soft edges and gradients', () => {
  const options: ImportOptions = {
    size: 16,
    background: 'auto',
    paletteMode: extract(4),
    alphaThreshold: 128,
  };

  it('hardens alpha and caps the colours', () => {
    const result = importSprite(gradient(), options);
    expect(hasAlphaOtherThan01(result.image)).toBe(false);
    expect(opaqueColours(result.image).size).toBeLessThanOrEqual(4);
    const allowed = new Set(result.colors.map(([r, g, b]) => `${r},${g},${b}`));
    for (const colour of opaqueColours(result.image)) expect(allowed.has(colour)).toBe(true);
    expect(result.warnings.some((warning) => /Reduced/.test(warning))).toBe(true);
  });

  it('drops pixels below the alpha threshold', () => {
    const result = importSprite(gradient(), options);
    // Source cells x 8..15 carry alpha 64; they must come out fully clear.
    for (let y = 4; y <= 11; y++) {
      expect(pixel(result.image, 2, y)[3]).toBe(0);
      expect(pixel(result.image, 3, y)[3]).toBe(0);
    }
  });

  it('is byte-identical across runs', () => {
    const first = encodePng(importSprite(gradient(), options).image);
    const second = encodePng(importSprite(gradient(), options).image);
    expect(Buffer.from(first).toString('hex')).toBe(Buffer.from(second).toString('hex'));
  });
});

describe('importSprite: snap', () => {
  it('uses only palette colours, darkest first', () => {
    const palette = [
      [0, 0, 0],
      [128, 128, 128],
      [255, 255, 255],
    ] as const;
    const result = importSprite(gradient(), {
      size: 16,
      background: 'auto',
      paletteMode: { kind: 'snap', palette },
      alphaThreshold: 128,
    });
    const allowed = new Set(palette.map(([r, g, b]) => `${r},${g},${b}`));
    for (const colour of opaqueColours(result.image)) expect(allowed.has(colour)).toBe(true);
    expect(result.colors.length).toBeGreaterThan(0);
    const luminance = ([r, g, b]: readonly number[]): number => 299 * r! + 587 * g! + 114 * b!;
    const values = result.colors.map(luminance);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it('extract colours are darkest first', () => {
    const result = importSprite(gradient(), {
      size: 16,
      background: 'auto',
      paletteMode: extract(4),
      alphaThreshold: 128,
    });
    const luminance = ([r, g, b]: readonly number[]): number => 299 * r! + 587 * g! + 114 * b!;
    const values = result.colors.map(luminance);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });
});

describe('importSprite: warnings and edge cases', () => {
  it('uses the centred square of a non-square picture', () => {
    const result = importSprite(image(100, 80), {
      size: 10,
      background: 'auto',
      paletteMode: extract(4),
      alphaThreshold: 128,
    });
    expect(result.warnings.some((warning) => /not square.*80 x 80/.test(warning))).toBe(true);
  });

  it('warns when the corners disagree', () => {
    const source = image(20, 20, MAGENTA);
    fill(source, 19, 19, 1, 1, RED);
    const result = importSprite(source, {
      size: 5,
      background: 'auto',
      paletteMode: extract(4),
      alphaThreshold: 128,
    });
    expect(result.warnings.some((warning) => /corners of the picture/.test(warning))).toBe(true);
  });

  it('trims a crop that runs outside the picture', () => {
    const result = importSprite(image(100, 100), {
      size: 10,
      crop: { x: 90, y: 90, w: 50, h: 50 },
      background: 'auto',
      paletteMode: extract(4),
      alphaThreshold: 128,
    });
    expect(result.warnings.some((warning) => /trimmed/.test(warning))).toBe(true);
  });

  it('repeats pixels when the source is smaller than the output', () => {
    const source = image(4, 4, MAGENTA);
    fill(source, 1, 1, 2, 2, RED);
    const result = importSprite(source, {
      size: 8,
      background: 'auto',
      paletteMode: extract(2),
      alphaThreshold: 128,
    });
    expect(result.warnings.some((warning) => /smaller than the output size/.test(warning))).toBe(true);
    expect(pixel(result.image, 2, 2)).toEqual([255, 0, 0, 255]);
    expect(pixel(result.image, 5, 5)).toEqual([255, 0, 0, 255]);
    expect(pixel(result.image, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('keeps a colour that ties with the background, so outlines survive', () => {
    const source = image(2, 2, MAGENTA);
    fill(source, 0, 1, 2, 1, RED);
    const result = importSprite(source, {
      size: 1,
      background: 'auto',
      paletteMode: extract(2),
      alphaThreshold: 128,
    });
    expect(pixel(result.image, 0, 0)).toEqual([255, 0, 0, 255]);
  });

  it('rejects an empty snap palette', () => {
    expect(() =>
      importSprite(image(4, 4), {
        size: 2,
        background: 'auto',
        paletteMode: { kind: 'snap', palette: [] },
        alphaThreshold: 128,
      }),
    ).toThrow(/palette is empty/);
  });
});
