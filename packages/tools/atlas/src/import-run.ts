// The command behind `art:import`: art/src -> art/export (+ the generated boss palette).
// Node/Bun only. The pure work lives in index.ts, backdrop.ts, packer.ts and palette-file.ts.
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neutrals, skyRamps } from '@boss-rush/core';
import type { Rgb } from '@boss-rush/core';
import { decodePng, encodePng } from '@boss-rush/render';
import { importBackdrop } from './backdrop';
import { importSprite } from './index';
import type { RgbaImage } from './index';
import {
  REQUIRED_FORMS,
  VARIANTS,
  defaultSettings,
  defaultSizes,
  nativeSides,
  normaliseSettings,
  parseSettings,
  variantOptions,
} from './import-settings';
import type { ImportSettings, RawVariantSettings, VariantName } from './import-settings';
import { atlasFile, encodeAtlasPng, packAtlas } from './packer';
import type { AtlasEntry } from './packer';
import { renderPaletteBosses } from './palette-file';

export interface RunOptions {
  /** Repository root. Defaults to the folder above packages/tools/atlas/src. */
  root?: string;
  artSrc?: string;
  artExport?: string;
  palettePath?: string;
  alphaThreshold?: number;
  log?: (line: string) => void;
}

export interface RunResult {
  written: string[];
  skipped: { sprite: string; reason: string }[];
  errors: string[];
  warnings: string[];
  atlas: { width: number; height: number; keys: string[] };
  palette: Record<string, Rgb[]>;
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readPng(path: string): Promise<RgbaImage> {
  return decodePng(new Uint8Array(await readFile(path)));
}

async function writePng(path: string, image: RgbaImage): Promise<void> {
  await writeFile(path, encodePng(image));
}

async function listSpriteDirs(artSrc: string): Promise<string[]> {
  try {
    const entries = await readdir(artSrc, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function variantOf(key: string): { sprite: string; variant: VariantName } | null {
  // A native copy ends in its side: boss_bioe_light_96 belongs to boss_bioe.
  const bare = key.replace(/_\d+$/, '');
  for (const variant of VARIANTS) {
    const suffix = `_${variant}`;
    if (bare.endsWith(suffix)) {
      const sprite = bare.slice(0, -suffix.length);
      return sprite.length > 0 ? { sprite, variant } : null;
    }
  }
  return null;
}

export async function runImport(options: RunOptions = {}): Promise<RunResult> {
  const log = options.log ?? ((line: string) => console.log(line));
  const here = dirname(fileURLToPath(import.meta.url));
  const root = options.root ?? resolve(here, '../../../..');
  const artSrc = options.artSrc ?? join(root, 'art/src');
  const artExport = options.artExport ?? join(root, 'art/export');
  const palettePath = options.palettePath ?? join(root, 'packages/core/src/palette.bosses.ts');
  const spritesDir = join(artExport, 'sprites');
  const settingsPath = join(artExport, 'import.json');
  const threshold = options.alphaThreshold ?? 128;

  const result: RunResult = {
    written: [],
    skipped: [],
    errors: [],
    warnings: [],
    atlas: { width: 0, height: 0, keys: [] },
    palette: {},
  };
  const warn = (text: string): void => {
    result.warnings.push(text);
    log(`  warning: ${text}`);
  };
  const fail = (text: string): void => {
    result.errors.push(text);
    log(`  error: ${text}`);
  };

  await mkdir(spritesDir, { recursive: true });

  let settings: ImportSettings;
  try {
    settings = parseSettings(await readFile(settingsPath, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    settings = defaultSettings(await listSpriteDirs(artSrc));
  }
  for (const sprite of await listSpriteDirs(artSrc)) {
    if (!settings.sprites[sprite]) settings.sprites[sprite] = {};
  }

  const sizes = defaultSizes();
  const native = nativeSides();
  const bossSize = settings.size?.boss ?? sizes.boss;
  const portraitSize = settings.size?.portrait ?? sizes.portrait;
  // Native copies for every other profile side; an explicit size pins a single output.
  const bossSides = settings.size?.boss
    ? [bossSize]
    : [bossSize, ...native.boss.filter((side) => side !== bossSize)];
  const portraitSides = settings.size?.portrait
    ? [portraitSize]
    : [portraitSize, ...native.portrait.filter((side) => side !== portraitSize)];
  const paletteDay = [...skyRamps.day, ...Object.values(neutrals)];
  const activeMonsterKeys = new Set<string>();

  log('art:import');
  for (const sprite of Object.keys(settings.sprites).sort()) {
    const raw = settings.sprites[sprite]!;
    const dir = join(artSrc, sprite);
    const sources = new Map<VariantName, RgbaImage>();
    const missing: string[] = [];
    for (const variant of [...REQUIRED_FORMS, 'monster'] as const) {
      const path = join(dir, `${variant}.png`);
      if (!(await exists(path))) {
        if (variant !== 'monster') missing.push(`${variant}.png`);
        continue;
      }
      try {
        sources.set(variant, await readPng(path));
      } catch (error) {
        if (variant !== 'monster') missing.push(`${variant}.png`);
        fail(`${sprite}/${variant}.png could not be read (${message(error)}); PNG must be 8-bit and not palette-indexed.`);
      }
    }
    if (missing.length > 0) {
      result.skipped.push({ sprite, reason: missing.join(', ') });
      warn(`${sprite} skipped: missing ${missing.join(', ')}; the boss stays hidden.`);
      continue;
    }

    const writeVariant = async (
      variant: VariantName,
      source: RgbaImage,
      variantSettings: RawVariantSettings | undefined,
      sides: readonly number[],
      label: string,
    ): Promise<void> => {
      // The largest side keeps the plain key (the render contract); smaller ones add `_<side>`.
      for (const [index, side] of sides.entries()) {
        const key = index === 0 ? `${sprite}_${variant}` : `${sprite}_${variant}_${side}`;
        const outPath = join(spritesDir, `${key}.png`);
        if (raw.locked?.includes(variant) && (await exists(outPath))) {
          log(`  ${key} kept (locked)`);
        } else {
          if (raw.locked?.includes(variant)) warn(`${key} is locked but missing; importing it.`);
          try {
            const imported = importSprite(source, variantOptions(variantSettings, side, threshold));
            for (const note of imported.warnings) log(`  ${key}: ${note}`);
            await writePng(outPath, imported.image);
            result.written.push(`${key}.png`);
            log(`  ${key} written (${label}, ${side} px)`);
          } catch (error) {
            fail(`${key}: ${message(error)}`);
            continue;
          }
        }
        if (variant === 'monster') activeMonsterKeys.add(key);
      }
    };

    for (const [variant, source] of sources) {
      const settings = variant === 'monster' ? { ...raw.final, ...raw.monster } : raw[variant];
      await writeVariant(variant, source, settings, bossSides, 'boss zone');
    }

    const portraitFile = join(dir, 'portrait.png');
    if (await exists(portraitFile)) {
      let portrait: RgbaImage | null = null;
      try {
        portrait = await readPng(portraitFile);
      } catch (error) {
        fail(`${sprite}/portrait.png could not be read (${message(error)}); cutting from light.png instead.`);
      }
      if (portrait) {
        // A dedicated portrait is used as it is; the saved crop belongs to light.png.
        const settingsWithoutCrop: RawVariantSettings = { ...(raw.portrait ?? {}) };
        delete settingsWithoutCrop.crop;
        await writeVariant('portrait', portrait, settingsWithoutCrop, portraitSides, 'dedicated portrait');
      } else {
        await writeVariant('portrait', sources.get('light')!, raw.portrait, portraitSides, 'cut from light.png');
      }
    } else {
      if (!raw.portrait?.crop) {
        warn(`${sprite}: no portrait.png and no saved portrait crop; using the centred square of light.png.`);
      }
      await writeVariant('portrait', sources.get('light')!, raw.portrait, portraitSides, 'cut from light.png');
    }
  }

  const backdropFile = join(artSrc, 'backdrop.png');
  if (await exists(backdropFile)) {
    try {
      const source = await readPng(backdropFile);
      const imported = importBackdrop(source, {
        width: sizes.backdrop.width,
        height: sizes.backdrop.height,
        palette: paletteDay,
        alphaThreshold: threshold,
      });
      for (const note of imported.warnings) log(`  backdrop: ${note}`);
      await writePng(join(spritesDir, 'backdrop.png'), imported.image);
      result.written.push('backdrop.png');
      log(`  backdrop written (${sizes.backdrop.width} x ${sizes.backdrop.height}, day ramp)`);
    } catch (error) {
      fail(`backdrop.png could not be imported (${message(error)}).`);
    }
  } else {
    warn('art/src/backdrop.png is missing; no backdrop was imported.');
  }

  // Keep even hand-edited, locked PNGs on disk and in the lint palette. A withdrawn monster
  // source, however, must stop appearing on the lock screen on the very next import.
  const files = (await readdir(spritesDir).catch(() => [] as string[]))
    .filter((file) => file.endsWith('.png'))
    .sort();
  const entries: AtlasEntry[] = [];
  const colours = new Map<string, Set<number>>();
  for (const file of files) {
    const key = file.slice(0, -'.png'.length);
    try {
      const image = await readPng(join(spritesDir, file));
      const form = variantOf(key);
      if (form?.variant !== 'monster' || activeMonsterKeys.has(key)) entries.push({ key, image });
      if (form) {
        const { sprite } = form;
        const set = colours.get(sprite) ?? new Set<number>();
        for (let i = 0; i < image.rgba.length; i += 4) {
          if (image.rgba[i + 3] !== 255) continue;
          set.add((image.rgba[i]! << 16) | (image.rgba[i + 1]! << 8) | image.rgba[i + 2]!);
        }
        colours.set(sprite, set);
      }
    } catch (error) {
      fail(`${file} could not be read (${message(error)}).`);
    }
  }

  const atlas = packAtlas(entries);
  await writeFile(join(artExport, 'atlas.png'), encodeAtlasPng(atlas));
  await writeFile(join(artExport, 'atlas.json'), `${JSON.stringify(atlasFile(atlas), null, 2)}\n`);
  result.atlas = { width: atlas.width, height: atlas.height, keys: Object.keys(atlas.sprites).sort() };

  const ramps: Record<string, Rgb[]> = {};
  for (const sprite of [...colours.keys()].sort()) {
    ramps[sprite] = [...colours.get(sprite)!]
      .sort((a, b) => {
        const la = 299 * ((a >> 16) & 0xff) + 587 * ((a >> 8) & 0xff) + 114 * (a & 0xff);
        const lb = 299 * ((b >> 16) & 0xff) + 587 * ((b >> 8) & 0xff) + 114 * (b & 0xff);
        return la - lb || a - b;
      })
      .map((p): Rgb => [(p >> 16) & 0xff, (p >> 8) & 0xff, p & 0xff]);
  }
  await writeFile(palettePath, renderPaletteBosses(ramps));
  result.palette = ramps;

  const ordered: ImportSettings = { version: 1, sprites: {} };
  if (settings.size) ordered.size = settings.size;
  for (const sprite of Object.keys(settings.sprites).sort()) {
    ordered.sprites[sprite] = settings.sprites[sprite]!;
  }
  if (settings.backdrop) ordered.backdrop = settings.backdrop;
  await writeFile(settingsPath, `${JSON.stringify(normaliseSettings(ordered), null, 2)}\n`);

  log(
    `  atlas ${atlas.width} x ${atlas.height} with ${result.atlas.keys.length} sprite(s); ` +
      `palette ${Object.keys(ramps).length} boss(es) -> ${relative(root, palettePath)}`,
  );
  return result;
}
