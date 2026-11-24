// The arena backdrop fills the whole logical canvas (180 x 390, from the profile), not a square,
// while `importSprite` is square by contract. Same rules: block majority, no blending, alpha hard,
// then snap to the `day` sky ramp plus the neutrals. Pure.
import type { Rgb } from '@boss-rush/core';
import type { RgbaImage } from './index';

export interface BackdropOptions {
  width: number;
  height: number;
  palette: readonly Rgb[];
  alphaThreshold?: number;
}

export interface BackdropResult {
  image: RgbaImage;
  colors: Rgb[];
  warnings: string[];
}

export function importBackdrop(source: RgbaImage, options: BackdropOptions): BackdropResult {
  const { width, height } = options;
  const threshold = options.alphaThreshold ?? 128;
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    throw new Error('importBackdrop: width and height must be positive whole numbers');
  }
  if (options.palette.length === 0) throw new Error('importBackdrop: the palette is empty');

  const warnings: string[] = [];
  if (source.width * height !== source.height * width) {
    warnings.push(`The picture is ${source.width} x ${source.height}; it was stretched to ${width} x ${height}.`);
  }
  if (source.width < width || source.height < height) {
    warnings.push(`The picture is smaller than ${width} x ${height}; some pixels are repeated.`);
  }

  const pack = (r: number, g: number, b: number): number => (r << 16) | (g << 8) | b;
  const luminance = (p: number): number =>
    299 * ((p >> 16) & 0xff) + 587 * ((p >> 8) & 0xff) + 114 * (p & 0xff);
  const palette = options.palette.map(([r, g, b]) => pack(r, g, b));
  const nearest = (colour: number): number => {
    let best = palette[0]!;
    let bestDistance = Infinity;
    for (const candidate of palette) {
      const dr = ((colour >> 16) & 0xff) - ((candidate >> 16) & 0xff);
      const dg = ((colour >> 8) & 0xff) - ((candidate >> 8) & 0xff);
      const db = (colour & 0xff) - (candidate & 0xff);
      const distance = dr * dr + dg * dg + db * db;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    return best;
  };

  const src = source.rgba;
  const out = new Uint8Array(width * height * 4);

  for (let oy = 0; oy < height; oy++) {
    const sy0 = Math.min(source.height - 1, Math.floor((oy * source.height) / height));
    const sy1 = Math.max(sy0 + 1, Math.min(source.height, Math.floor(((oy + 1) * source.height) / height)));
    for (let ox = 0; ox < width; ox++) {
      const sx0 = Math.min(source.width - 1, Math.floor((ox * source.width) / width));
      const sx1 = Math.max(sx0 + 1, Math.min(source.width, Math.floor(((ox + 1) * source.width) / width)));
      const counts = new Map<number, number>();
      let transparent = 0;
      for (let y = sy0; y < sy1; y++) {
        for (let x = sx0; x < sx1; x++) {
          const i = (y * source.width + x) * 4;
          if (src[i + 3]! < threshold) {
            transparent++;
            continue;
          }
          const colour = pack(src[i]!, src[i + 1]!, src[i + 2]!);
          counts.set(colour, (counts.get(colour) ?? 0) + 1);
        }
      }
      let winner = -1;
      let winnerCount = 0;
      for (const [colour, count] of counts) {
        if (count > winnerCount || (count === winnerCount && colour < winner)) {
          winner = colour;
          winnerCount = count;
        }
      }
      if (winner < 0 || winnerCount < transparent) continue;
      const mapped = nearest(winner);
      const o = (oy * width + ox) * 4;
      out[o] = (mapped >> 16) & 0xff;
      out[o + 1] = (mapped >> 8) & 0xff;
      out[o + 2] = mapped & 0xff;
      out[o + 3] = 255;
    }
  }

  const used = new Set<number>();
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 255) used.add(pack(out[i]!, out[i + 1]!, out[i + 2]!));
  }
  const colors = [...used]
    .sort((a, b) => luminance(a) - luminance(b) || a - b)
    .map((p): Rgb => [(p >> 16) & 0xff, (p >> 8) & 0xff, p & 0xff]);

  return { image: { width, height, rgba: out }, colors, warnings };
}
