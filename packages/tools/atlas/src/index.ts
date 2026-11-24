// Art import: a Gemini picture in, a game-ready sprite out. Spec: design/art.md.
// SHARED CONTRACT: the types and the importSprite() signature are integrator-only.
// Brief E implements the body, the CLI (cli.ts, run with Bun) and the atlas packer.
//
// This file must stay free of Node and DOM imports: the web art bench
// (packages/web/src/artbench) calls the same function as the CLI.
import type { Rect, Rgb } from '@boss-rush/core';

/** RGBA, row-major, any size. Alpha may be anything on input. */
export interface RgbaImage {
  width: number;
  height: number;
  rgba: Uint8Array;
}

/**
 * The owner has not chosen the palette source yet (design/art.md), so both are supported:
 * - `extract`: take the `colors` most important colours from this picture;
 * - `snap`: move every pixel to the nearest colour of a given palette.
 */
export type PaletteMode =
  | { kind: 'extract'; colors: number }
  | { kind: 'snap'; palette: readonly Rgb[] };

export interface ImportOptions {
  /** Output side in logical px (the sprite is square), e.g. the profile's boss size. */
  size: number;
  /** Part of the source to use, in source pixels. Omitted: the whole picture. */
  crop?: Rect;
  /** Background colour to remove. `auto` reads it from the corners. */
  background: 'auto' | Rgb;
  paletteMode: PaletteMode;
  /** Source alpha at or above this becomes opaque, below it transparent. 0..255. */
  alphaThreshold: number;
}

export interface ImportResult {
  /** `size` x `size`. Alpha is 0 or 255 only; every opaque pixel is one of `colors`. */
  image: RgbaImage;
  /** The colours used, darkest first. In `extract` mode these go into palette.bosses.ts. */
  colors: Rgb[];
  /** Human-readable notes for the owner, e.g. "background not uniform". */
  warnings: string[];
}

/** Pure and deterministic: same picture + options -> identical result. */
export function importSprite(source: RgbaImage, options: ImportOptions): ImportResult {
  const warnings: string[] = [];
  const { size } = options;
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`importSprite: size must be a positive whole number, got ${size}`);
  }
  if (!Number.isInteger(options.alphaThreshold) || options.alphaThreshold < 0 || options.alphaThreshold > 255) {
    throw new Error(`importSprite: alphaThreshold must be 0..255, got ${options.alphaThreshold}`);
  }
  if (!Number.isInteger(source.width) || !Number.isInteger(source.height) || source.width < 1 || source.height < 1) {
    throw new Error('importSprite: the picture is empty');
  }

  const BACKGROUND_TOLERANCE = 32;

  const pack = (r: number, g: number, b: number): number => (r << 16) | (g << 8) | b;
  const unpack = (p: number): Rgb => [(p >> 16) & 0xff, (p >> 8) & 0xff, p & 0xff];
  const hex = (p: number): string => `#${p.toString(16).padStart(6, '0')}`;
  const luminance = (p: number): number =>
    299 * ((p >> 16) & 0xff) + 587 * ((p >> 8) & 0xff) + 114 * (p & 0xff);
  const darkestFirst = (colours: Iterable<number>): number[] =>
    [...colours].sort((a, b) => luminance(a) - luminance(b) || a - b);
  const checkChannel = (name: string, value: number): void => {
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error(`importSprite: ${name} must be 0..255, got ${value}`);
    }
  };

  // 1. Crop, then the centred square inside it.
  let cropX = 0;
  let cropY = 0;
  let cropW = source.width;
  let cropH = source.height;
  const hasCrop = options.crop !== undefined;
  if (options.crop) {
    const c = options.crop;
    if (![c.x, c.y, c.w, c.h].every(Number.isInteger) || c.w < 1 || c.h < 1) {
      throw new Error('importSprite: crop must be whole pixels with w and h at least 1');
    }
    const left = Math.max(0, c.x);
    const top = Math.max(0, c.y);
    const right = Math.min(source.width, c.x + c.w);
    const bottom = Math.min(source.height, c.y + c.h);
    if (right <= left || bottom <= top) {
      throw new Error('importSprite: the crop does not overlap the picture');
    }
    if (left !== c.x || top !== c.y || right !== c.x + c.w || bottom !== c.y + c.h) {
      warnings.push('Part of the crop box was outside the picture, so it was trimmed to fit.');
    }
    cropX = left;
    cropY = top;
    cropW = right - left;
    cropH = bottom - top;
  }
  if (cropW !== cropH) {
    const side = Math.min(cropW, cropH);
    const subject = hasCrop ? 'The crop' : 'The picture';
    warnings.push(`${subject} is ${cropW} x ${cropH}, not square; using the centred ${side} x ${side} square.`);
    cropX += Math.floor((cropW - side) / 2);
    cropY += Math.floor((cropH - side) / 2);
    cropW = side;
    cropH = side;
  }

  const rgba = source.rgba;
  const pixelAt = (x: number, y: number): number => (y * source.width + x) * 4;

  // 2. Background: the given colour, or the colour the four kept corners share.
  let background = -1;
  if (options.background === 'auto') {
    const corners: number[] = [];
    const cornerAlphas: number[] = [];
    for (const [x, y] of [
      [cropX, cropY],
      [cropX + cropW - 1, cropY],
      [cropX, cropY + cropH - 1],
      [cropX + cropW - 1, cropY + cropH - 1],
    ] as const) {
      const i = pixelAt(x, y);
      corners.push(pack(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!));
      cornerAlphas.push(rgba[i + 3]!);
    }
    const opaque = corners.filter((_, index) => cornerAlphas[index]! >= options.alphaThreshold);
    if (opaque.length > 0) {
      let best = opaque[0]!;
      let bestCount = 0;
      for (const candidate of opaque) {
        let count = 0;
        for (const other of opaque) if (other === candidate) count++;
        if (count > bestCount) {
          best = candidate;
          bestCount = count;
        }
      }
      background = best;
      if (new Set(opaque).size > 1) {
        warnings.push(`The corners of the picture are not one colour; using ${hex(best)} as the background.`);
      }
    }
  } else {
    const [r, g, b] = options.background;
    checkChannel('background red', r);
    checkChannel('background green', g);
    checkChannel('background blue', b);
    background = pack(r, g, b);
  }

  // 3 and 4. Shrink without blending; each cell takes the most common partial colour,
  // and the transparent bucket wins ties so edges do not grow.
  const out = new Uint8Array(size * size * 4);
  let upscaled = false;
  const rowStart = (index: number, length: number, origin: number): number => {
    const start = Math.floor((index * length) / size);
    return origin + Math.min(start, length - 1);
  };
  const rowEnd = (index: number, length: number, origin: number): number => {
    const start = Math.floor((index * length) / size);
    let end = Math.floor(((index + 1) * length) / size);
    if (end <= start) {
      end = start + 1;
      upscaled = true;
    }
    return origin + Math.min(end, length);
  };
  for (let oy = 0; oy < size; oy++) {
    const y0 = rowStart(oy, cropH, cropY);
    const y1 = rowEnd(oy, cropH, cropY);
    for (let ox = 0; ox < size; ox++) {
      const x0 = rowStart(ox, cropW, cropX);
      const x1 = rowEnd(ox, cropW, cropX);
      const counts = new Map<number, number>();
      let transparent = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = pixelAt(x, y);
          const alpha = rgba[i + 3]!;
          if (alpha < options.alphaThreshold) {
            transparent++;
            continue;
          }
          const colour = pack(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
          if (background >= 0) {
            const dr = Math.abs(((colour >> 16) & 0xff) - ((background >> 16) & 0xff));
            const dg = Math.abs(((colour >> 8) & 0xff) - ((background >> 8) & 0xff));
            const db = Math.abs((colour & 0xff) - (background & 0xff));
            if (Math.max(dr, dg, db) <= BACKGROUND_TOLERANCE) {
              transparent++;
              continue;
            }
          }
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
      const o = (oy * size + ox) * 4;
      // A colour wins ties against the background bucket, so a one-pixel outline survives.
      if (winner >= 0 && winnerCount >= transparent) {
        out[o] = (winner >> 16) & 0xff;
        out[o + 1] = (winner >> 8) & 0xff;
        out[o + 2] = winner & 0xff;
        out[o + 3] = 255;
      }
    }
  }
  if (upscaled) {
    warnings.push(`The ${cropW} x ${cropH} square is smaller than the output size ${size} x ${size}; some pixels are repeated.`);
  }

  // 5. Colours, on the opaque pixels only.
  const present = new Map<number, number>();
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] !== 255) continue;
    const colour = pack(out[i]!, out[i + 1]!, out[i + 2]!);
    present.set(colour, (present.get(colour) ?? 0) + 1);
  }

  let palette: number[] = [];
  if (options.paletteMode.kind === 'extract') {
    const limit = options.paletteMode.colors;
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error(`importSprite: extract colors must be a positive whole number, got ${limit}`);
    }
    const ranked = [...present.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .map(([colour]) => colour);
    palette = ranked.slice(0, limit);
    if (ranked.length < limit) {
      warnings.push(`The sprite has only ${ranked.length} colour${ranked.length === 1 ? '' : 's'}; ${limit} were requested.`);
    } else if (ranked.length > limit) {
      warnings.push(`Reduced ${ranked.length} colours to ${limit}, the most common ones.`);
    }
  } else {
    const given = options.paletteMode.palette;
    if (given.length === 0) {
      throw new Error('importSprite: the snap palette is empty');
    }
    for (const [r, g, b] of given) {
      checkChannel('palette red', r);
      checkChannel('palette green', g);
      checkChannel('palette blue', b);
    }
    palette = given.map(([r, g, b]) => pack(r, g, b));
  }

  if (palette.length > 0) {
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
    const used = new Set<number>();
    for (let i = 0; i < out.length; i += 4) {
      if (out[i + 3] !== 255) continue;
      const mapped = nearest(pack(out[i]!, out[i + 1]!, out[i + 2]!));
      out[i] = (mapped >> 16) & 0xff;
      out[i + 1] = (mapped >> 8) & 0xff;
      out[i + 2] = mapped & 0xff;
      used.add(mapped);
    }
    palette = darkestFirst(used);
  }

  return {
    image: { width: size, height: size, rgba: out },
    colors: palette.map(unpack),
    warnings,
  };
}
