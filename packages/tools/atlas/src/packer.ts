// Deterministic atlas packer: named sprites at game resolution -> one sheet.
// Pure. The renderer reads the result through the `Atlas` type (packages/render/src/render.ts).
import { encodePng } from '@boss-rush/render';
import type { Atlas, Frame } from '@boss-rush/render';
import type { RgbaImage } from './index';

export interface AtlasEntry {
  key: string;
  image: RgbaImage;
}

/** atlas.json: the `Atlas` shape without `rgba`. */
export interface AtlasFile {
  sprites: Record<string, { x: number; y: number; w: number; h: number }>;
  width: number;
  height: number;
}

export const ATLAS_MAX_WIDTH = 512;

/**
 * Shelf packing, ordered by height then width then key, so the same input always gives the
 * same sheet. A sheet wider than `maxWidth` (the backdrop) still fits its own row.
 */
export function packAtlas(entries: readonly AtlasEntry[], maxWidth = ATLAS_MAX_WIDTH): Atlas {
  const placed = entries
    .filter((entry) => entry.image.width > 0 && entry.image.height > 0)
    .sort((a, b) => b.image.height - a.image.height || b.image.width - a.image.width || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const sheetWidth = Math.max(1, maxWidth, ...placed.map((entry) => entry.image.width));
  const sprites: Atlas['sprites'] = {};
  const positions: { entry: AtlasEntry; x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let shelfHeight = 0;
  let usedWidth = 0;
  for (const entry of placed) {
    const { width, height } = entry.image;
    if (x > 0 && x + width > sheetWidth) {
      y += shelfHeight;
      x = 0;
      shelfHeight = 0;
    }
    positions.push({ entry, x, y });
    sprites[entry.key] = { x, y, w: width, h: height };
    x += width;
    shelfHeight = Math.max(shelfHeight, height);
    usedWidth = Math.max(usedWidth, x);
  }

  const width = Math.max(1, usedWidth);
  const height = Math.max(1, y + shelfHeight);
  const rgba = new Uint8Array(width * height * 4);
  for (const { entry, x: px, y: py } of positions) {
    const { width: w, height: h, rgba: src } = entry.image;
    for (let row = 0; row < h; row++) {
      const from = row * w * 4;
      const to = ((py + row) * width + px) * 4;
      rgba.set(src.subarray(from, from + w * 4), to);
    }
  }
  return { sprites, rgba, width, height };
}

export function atlasFile(atlas: Atlas): AtlasFile {
  const sprites: AtlasFile['sprites'] = {};
  for (const key of Object.keys(atlas.sprites).sort()) {
    sprites[key] = { ...atlas.sprites[key]! };
  }
  return { sprites, width: atlas.width, height: atlas.height };
}

export function encodeAtlasPng(atlas: Atlas): Uint8Array {
  const frame: Frame = { width: atlas.width, height: atlas.height, rgba: atlas.rgba };
  return encodePng(frame);
}
