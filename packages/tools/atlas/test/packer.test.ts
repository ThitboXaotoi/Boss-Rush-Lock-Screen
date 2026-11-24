import { describe, expect, it } from 'vitest';
import { decodePng } from '@boss-rush/render';
import type { Atlas } from '@boss-rush/render';
import { atlasFile, encodeAtlasPng, packAtlas } from '../src/packer';
import type { AtlasEntry } from '../src/packer';
import { fill, image, pixel } from './fixtures';

function entries(): AtlasEntry[] {
  const a = image(4, 2, [255, 0, 0]);
  fill(a, 1, 0, 1, 1, [0, 0, 255]);
  const b = image(2, 4, [0, 255, 0]);
  const c = image(3, 3, [10, 20, 30]);
  fill(c, 2, 2, 1, 1, [40, 50, 60]);
  return [
    { key: 'c', image: c },
    { key: 'a', image: a },
    { key: 'b', image: b },
  ];
}

function readAtlas(atlas: Atlas, key: string, x: number, y: number): number[] {
  const rect = atlas.sprites[key]!;
  const i = ((rect.y + y) * atlas.width + rect.x + x) * 4;
  return [atlas.rgba[i]!, atlas.rgba[i + 1]!, atlas.rgba[i + 2]!, atlas.rgba[i + 3]!];
}

describe('packAtlas', () => {
  it('packs three sprites without overlap and reads back identical pixels', () => {
    const source = entries();
    const atlas = packAtlas(source);
    expect(Object.keys(atlas.sprites).sort()).toEqual(['a', 'b', 'c']);

    for (const entry of source) {
      const rect = atlas.sprites[entry.key]!;
      expect(rect.w).toBe(entry.image.width);
      expect(rect.h).toBe(entry.image.height);
      for (let y = 0; y < rect.h; y++) {
        for (let x = 0; x < rect.w; x++) {
          expect(readAtlas(atlas, entry.key, x, y)).toEqual(pixel(entry.image, x, y));
        }
      }
    }

    const rects = Object.values(atlas.sprites);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const p = rects[i]!;
        const q = rects[j]!;
        const overlap =
          p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
        expect(overlap).toBe(false);
      }
    }
  });

  it('is deterministic regardless of input order', () => {
    const forward = packAtlas(entries());
    const backward = packAtlas([...entries()].reverse());
    expect(Buffer.from(encodeAtlasPng(forward)).toString('hex')).toBe(
      Buffer.from(encodeAtlasPng(backward)).toString('hex'),
    );
  });

  it('writes atlas.json without rgba and with sorted keys', () => {
    const file = atlasFile(packAtlas(entries()));
    expect(Object.keys(file.sprites)).toEqual(['a', 'b', 'c']);
    expect('rgba' in file).toBe(false);
    expect(file.width).toBeGreaterThan(0);
    expect(file.height).toBeGreaterThan(0);
  });

  it('survives a PNG round trip', () => {
    const atlas = packAtlas(entries());
    const decoded = decodePng(encodeAtlasPng(atlas));
    expect(decoded.width).toBe(atlas.width);
    expect(decoded.height).toBe(atlas.height);
    expect(Buffer.from(decoded.rgba).toString('hex')).toBe(Buffer.from(atlas.rgba).toString('hex'));
  });

  it('makes a valid 1 x 1 sheet with no sprites', () => {
    const atlas = packAtlas([]);
    expect(atlas.sprites).toEqual({});
    expect(atlas.width).toBe(1);
    expect(atlas.height).toBe(1);
    expect(decodePng(encodeAtlasPng(atlas)).width).toBe(1);
  });
});
