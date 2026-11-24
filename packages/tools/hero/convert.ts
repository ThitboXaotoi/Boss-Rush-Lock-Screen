// Hero art import: the owner's two Gemini hero pictures -> packages/render/src/art/hero.ts.
//   bun run --filter @boss-rush/tools hero:import
// Reads art/src/hero/idle.png and art/src/hero/ready.png (any size). Uses the input's alpha or,
// on an opaque sheet, removes a light background by flood fill from the edges. Crops both poses to
// one shared square (so they keep the same scale), puts the feet on the bottom edge, shrinks to
// HERO_SIZE by the most common colour per block (no blending), and snaps to the neutral palette.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neutrals } from '@boss-rush/core';
import type { NeutralName, Rgb } from '@boss-rush/core';
import type { Frame } from '@boss-rush/render';
// Do not import the render barrel at runtime: it imports the file we are generating.
import { HERO_SIZE } from '../../render/src/art/types';
import { decodePng } from '../../render/src/png';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const SOURCES = { idle: 'art/src/hero/idle.png', ready: 'art/src/hero/ready.png' } as const;
const TARGET = 'packages/render/src/art/hero.ts';
/** A block becomes transparent when at least this share of it is background. */
const CLEAR_SHARE = 0.6;
const KEYS: Record<NeutralName, string> = {
  black: 'k', ink: 'i', slate: 's', steel: 't', fog: 'f', white: 'w', warning: 'r', gold: 'g', maroon: 'm',
};

interface Cut { width: number; height: number; rgba: Uint8Array; bg: Uint8Array; box: [number, number, number, number] }

function isBackground(r: number, g: number, b: number): boolean {
  return Math.min(r, g, b) >= 215 && Math.max(r, g, b) - Math.min(r, g, b) <= 18;
}

function cut({ width, height, rgba }: Frame, pose: string): Cut {
  const bg = new Uint8Array(width * height);
  let hasAlphaMask = false;
  for (let i = 0; i < bg.length; i++) {
    if (rgba[i * 4 + 3]! < 128) {
      bg[i] = 1;
      hasAlphaMask = true;
    }
  }
  const stack: number[] = [];
  if (!hasAlphaMask) {
    for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
    for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    if (bg[i] || !isBackground(rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!)) continue;
    bg[i] = 1;
    const x = i % width;
    if (x > 0) stack.push(i - 1);
    if (x < width - 1) stack.push(i + 1);
    if (i >= width) stack.push(i - width);
    if (i < width * (height - 1)) stack.push(i + width);
  }
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let i = 0; i < bg.length; i++) {
    if (bg[i]) continue;
    const x = i % width, y = (i / width) | 0;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (x1 < 0) throw new Error(`${pose}: no character found (everything looks like background)`);
  return { width, height, rgba, bg, box: [x0, y0, x1, y1] };
}

const names = Object.keys(neutrals) as NeutralName[];
function nearest(r: number, g: number, b: number): NeutralName {
  let best = names[0]!, dist = Infinity;
  for (const n of names) {
    const c: Rgb = neutrals[n];
    const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
    if (d < dist) { dist = d; best = n; }
  }
  return best;
}

function shrink(src: Cut, side: number): string[] {
  const [x0, , x1, y1] = src.box;
  const left = x0 + Math.floor((x1 - x0 + 1 - side) / 2);
  const top = y1 - side + 1;
  const rows: string[] = [];
  for (let j = 0; j < HERO_SIZE; j++) {
    let row = '';
    const sy = top + Math.floor(j * side / HERO_SIZE);
    const endY = Math.max(sy + 1, top + Math.floor((j + 1) * side / HERO_SIZE));
    for (let i = 0; i < HERO_SIZE; i++) {
      const sx = left + Math.floor(i * side / HERO_SIZE);
      const endX = Math.max(sx + 1, left + Math.floor((i + 1) * side / HERO_SIZE));
      const counts = new Map<NeutralName, number>();
      let clear = 0, total = 0;
      for (let y = sy; y < endY; y++) {
        for (let x = sx; x < endX; x++) {
          total++;
          const k = y * src.width + x;
          if (x < 0 || y < 0 || x >= src.width || y >= src.height || src.bg[k]) { clear++; continue; }
          const n = nearest(src.rgba[k * 4]!, src.rgba[k * 4 + 1]!, src.rgba[k * 4 + 2]!);
          counts.set(n, (counts.get(n) ?? 0) + 1);
        }
      }
      if (counts.size === 0 || clear >= total * CLEAR_SHARE) { row += '.'; continue; }
      // Most common colour; ties broken by palette order, so the output is deterministic.
      let pick = names[0]!, most = -1;
      for (const n of names) if ((counts.get(n) ?? 0) > most) { most = counts.get(n) ?? 0; pick = n; }
      row += KEYS[pick];
    }
    rows.push(row);
  }
  return rows;
}

export function poseRows(idle: Frame, ready: Frame) {
  const cuts = { idle: cut(idle, SOURCES.idle), ready: cut(ready, SOURCES.ready) };
  const side = Math.max(...Object.values(cuts).map(({ box: [x0, y0, x1, y1] }) => Math.max(x1 - x0, y1 - y0) + 1));
  return { idle: shrink(cuts.idle, side), ready: shrink(cuts.ready, side), side };
}

const sprite = (rows: string[]) => {
  const used = names.filter(n => rows.some(r => r.includes(KEYS[n])));
  const colors = ["'.': null", ...used.map(n => `${KEYS[n]}: '${n}'`)].join(', ');
  return `{\n  colors: { ${colors} },\n  rows: [\n${rows.map(r => `    '${r}',`).join('\n')}\n  ],\n}`;
};
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const read = (path: string) => decodePng(readFileSync(join(ROOT, path)));
  const poses = poseRows(read(SOURCES.idle), read(SOURCES.ready));
  writeFileSync(join(ROOT, TARGET), `// OWNER ART, generated from art/src/hero/idle.png and ready.png by
//   bun run --filter @boss-rush/tools hero:import
// Do not edit by hand; replace the pictures and re-run instead. No agent edits this file.
import type { PixelSprite } from './types';

/** Normal pose. */
export const hero: PixelSprite = ${sprite(poses.idle)};

/** Battle-ready pose, shown in the last days before the front deadline (phase final or now). */
export const heroReady: PixelSprite = ${sprite(poses.ready)};
`);
  console.log(`hero: wrote ${TARGET} (${HERO_SIZE} x ${HERO_SIZE}, shared crop ${poses.side} px)`);
}
