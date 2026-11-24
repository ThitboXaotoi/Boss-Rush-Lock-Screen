import { Buffer } from 'node:buffer';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { env } from 'node:process';
import { URL } from 'node:url';
import { allColors, compact, fixtureScenes } from '@boss-rush/core';
import { expect, it } from 'vitest';
import { decodePng, encodePng, placeholderAtlas, render } from '../src';
import type { Frame } from '../src';

const directory = new URL('./golden/', import.meta.url);
const atlas = placeholderAtlas(compact, Object.values(fixtureScenes).flatMap(({ front, queue }) =>
  (front ? [front, ...queue] : queue).map(boss => boss.sprite),
));
const cases = [
  ...Object.entries(fixtureScenes).map(([name, scene]) => ({ name, scene, device: compact.logical })),
  { name: 'enragedDusk-1179x2556', scene: fixtureScenes.enragedDusk, device: { width: 1179, height: 2556 } },
];
const rgbKey = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;
const allowed = new Set(allColors().map(c => rgbKey(...c)));

function checkPalette({ rgba, width }: Frame): void {
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] !== 255 || !allowed.has(rgbKey(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!))) {
      const x = (i / 4) % width;
      const y = Math.floor(i / 4 / width);
      throw new Error(`Unexpected RGBA at (${x}, ${y}): ${rgba.subarray(i, i + 4).join(', ')}`);
    }
  }
}

it.each(cases)('$name matches the opaque, palette-only golden PNG', ({ name, scene, device }) => {
  const frame = render(scene, compact, atlas, { device });
  const file = new URL(`${name}.png`, directory);
  if (env.UPDATE_GOLDEN === '1') {
    mkdirSync(directory, { recursive: true });
    writeFileSync(file, encodePng(frame));
  }

  const golden = decodePng(readFileSync(file));
  expect(golden.width).toBe(device.width);
  expect(golden.height).toBe(device.height);
  expect(Buffer.from(frame.rgba).equals(golden.rgba), `${name}.png pixels changed`).toBe(true);
  checkPalette(golden);
});

it('encodes repeated renders to identical bytes', () => {
  const draw = () => encodePng(render(fixtureScenes.enragedDusk, compact, atlas, { device: compact.logical }));
  expect(Buffer.from(draw()).equals(draw())).toBe(true);
});
