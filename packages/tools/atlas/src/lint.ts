// The sprite rules from design/art.md: alpha is 0 or 255, colours come from the palette only.
// Pure. The command (lint-cli.ts) reads and decodes the files.
import type { Rgb } from '@boss-rush/core';
import type { RgbaImage } from './index';
import { REQUIRED_VARIANTS, VARIANTS } from './import-settings';
import type { VariantName } from './import-settings';

export interface LintEntry {
  key: string;
  image: RgbaImage;
}

export interface LintReport {
  /** One line per rule broken, naming the sprite. */
  issues: string[];
  /** Sprite prefixes with Light, Dark, Final and the portrait; Monster is optional. */
  complete: string[];
  /** Sprite prefixes missing at least one variant. */
  incomplete: { sprite: string; missing: VariantName[] }[];
}

const hex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

export function lintSprites(entries: readonly LintEntry[], palette: readonly Rgb[]): LintReport {
  const allowed = new Set(palette.map(([r, g, b]) => ((r << 16) | (g << 8) | b) >>> 0));
  const issues: string[] = [];

  for (const { key, image } of entries) {
    const { rgba } = image;
    let halfTransparent = 0;
    let offPalette = 0;
    let firstAlpha = 0;
    let firstOff = '';

    for (let i = 0; i < rgba.length; i += 4) {
      const alpha = rgba[i + 3]!;
      if (alpha !== 0 && alpha !== 255) {
        if (halfTransparent === 0) firstAlpha = alpha;
        halfTransparent++;
        continue;
      }
      if (alpha === 0) continue;
      const colour = ((rgba[i]! << 16) | (rgba[i + 1]! << 8) | rgba[i + 2]!) >>> 0;
      if (!allowed.has(colour)) {
        if (offPalette === 0) {
          const pixel = i / 4;
          firstOff = `${hex([rgba[i]!, rgba[i + 1]!, rgba[i + 2]!])} at ${pixel % image.width},${Math.floor(pixel / image.width)}`;
        }
        offPalette++;
      }
    }

    if (halfTransparent > 0) {
      issues.push(`${key}: ${halfTransparent} pixels are partly transparent (first alpha ${firstAlpha}); alpha must be 0 or 255.`);
    }
    if (offPalette > 0) {
      issues.push(`${key}: ${offPalette} pixels use colours outside the palette (first ${firstOff}).`);
    }
  }

  const present = new Map<string, Set<VariantName>>();
  for (const { key } of entries) {
    for (const variant of VARIANTS) {
      const suffix = `_${variant}`;
      if (!key.endsWith(suffix)) continue;
      const sprite = key.slice(0, -suffix.length);
      if (sprite.length === 0) continue;
      const set = present.get(sprite) ?? new Set<VariantName>();
      set.add(variant);
      present.set(sprite, set);
    }
  }
  const complete: string[] = [];
  const incomplete: { sprite: string; missing: VariantName[] }[] = [];
  for (const sprite of [...present.keys()].sort()) {
    const have = present.get(sprite)!;
    const missing = REQUIRED_VARIANTS.filter((variant) => !have.has(variant));
    if (missing.length === 0) complete.push(sprite);
    else incomplete.push({ sprite, missing });
  }

  return { issues, complete, incomplete };
}
