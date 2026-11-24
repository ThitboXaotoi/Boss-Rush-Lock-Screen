// Per-sprite import settings, shared by the command and the art bench.
// The file lives at art/export/import.json; a re-run reproduces the owner's choices.
// Pure: no Node and no DOM imports (the art bench imports this module too).
import { profiles } from '@boss-rush/core';
import type { Rect, Rgb } from '@boss-rush/core';
import type { ImportOptions } from './index';

export const IMPORT_SETTINGS_VERSION = 1;

export const REQUIRED_FORMS = ['light', 'dark', 'final'] as const;
export const REQUIRED_VARIANTS = [...REQUIRED_FORMS, 'portrait'] as const;
export const VARIANTS = [...REQUIRED_VARIANTS, 'monster'] as const;
export type VariantName = (typeof VARIANTS)[number];

/** One variant as written in import.json. Omitted fields fall back to defaults. */
export interface RawVariantSettings {
  /** Source-pixel box. Omitted: the whole picture. */
  crop?: Rect;
  /** Omitted: 8. */
  colors?: number;
  /** Omitted: `extract`. */
  mode?: 'extract' | 'snap';
  /** Snap palette, `#rrggbb` strings. Needed only in snap mode. */
  palette?: string[];
  /** Omitted: `auto`. */
  background?: 'auto' | string;
}

export interface RawSpriteSettings {
  light?: RawVariantSettings;
  dark?: RawVariantSettings;
  final?: RawVariantSettings;
  /** Optional fourth form. Unspecified import settings are inherited from Final. */
  monster?: RawVariantSettings;
  portrait?: RawVariantSettings;
  /** Variants the owner edited by hand; the command never overwrites their PNGs. */
  locked?: VariantName[];
}

export interface ImportSettings {
  version: typeof IMPORT_SETTINGS_VERSION;
  /** Output side in game pixels. Omitted: the largest profile's zone. */
  size?: { boss?: number; portrait?: number };
  sprites: Record<string, RawSpriteSettings>;
  /** The one arena background. */
  backdrop?: RawVariantSettings;
}

export interface ResolvedVariantSettings {
  crop?: Rect;
  colors: number;
  mode: 'extract' | 'snap';
  palette: Rgb[];
  background: 'auto' | Rgb;
}

export const DEFAULT_VARIANT: Required<Pick<RawVariantSettings, 'colors' | 'mode' | 'background'>> = {
  colors: 8,
  mode: 'extract',
  background: 'auto',
};

export function parseHex(text: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(text.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1]!, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

export function hexOf(colour: Rgb): string {
  return `#${colour.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Output sizes come from the layout profiles, never from magic numbers here. */
export function defaultSizes(): { boss: number; portrait: number; backdrop: { width: number; height: number } } {
  const all = Object.values(profiles).filter((p): p is NonNullable<typeof p> => p !== undefined);
  return {
    boss: Math.max(...all.map((p) => p.zones.boss.w)),
    portrait: Math.max(...all.map((p) => p.queue.portrait)),
    backdrop: {
      width: Math.max(...all.map((p) => p.logical.width)),
      height: Math.max(...all.map((p) => p.logical.height)),
    },
  };
}

/**
 * Every distinct boss and portrait side across the profiles, largest first. The import writes
 * a native sprite for each (`<key>_<side>`), so a profile with a smaller zone shows the whole
 * picture instead of cropping the largest one. An explicit `size` in import.json pins one side
 * and switches the extra copies off.
 */
export function nativeSides(): { boss: number[]; portrait: number[] } {
  const all = Object.values(profiles).filter((p): p is NonNullable<typeof p> => p !== undefined);
  const distinct = (side: (profile: (typeof all)[number]) => number): number[] =>
    [...new Set(all.map(side))].sort((a, b) => b - a);
  return { boss: distinct((p) => p.zones.boss.w), portrait: distinct((p) => p.queue.portrait) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integer(value: unknown, path: string, min: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new Error(`${path} must be a whole number of at least ${min}`);
  }
  return value;
}

function parseCrop(value: unknown, path: string): Rect {
  if (!isRecord(value)) throw new Error(`${path} must be an object with x, y, w, h`);
  return {
    x: integer(value.x, `${path}.x`, 0),
    y: integer(value.y, `${path}.y`, 0),
    w: integer(value.w, `${path}.w`, 1),
    h: integer(value.h, `${path}.h`, 1),
  };
}

function parseVariant(value: unknown, path: string): RawVariantSettings {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  const out: RawVariantSettings = {};
  if (value.crop !== undefined) out.crop = parseCrop(value.crop, `${path}.crop`);
  if (value.colors !== undefined) out.colors = integer(value.colors, `${path}.colors`, 1);
  if (value.mode !== undefined) {
    if (value.mode !== 'extract' && value.mode !== 'snap') {
      throw new Error(`${path}.mode must be "extract" or "snap"`);
    }
    out.mode = value.mode;
  }
  if (value.palette !== undefined) {
    if (!Array.isArray(value.palette) || value.palette.some((c) => typeof c !== 'string' || parseHex(c) === null)) {
      throw new Error(`${path}.palette must be a list of #rrggbb colours`);
    }
    out.palette = value.palette.map((c) => c.trim());
  }
  if (value.background !== undefined) {
    if (value.background === 'auto') out.background = 'auto';
    else if (typeof value.background === 'string' && parseHex(value.background) !== null) {
      out.background = value.background.trim();
    } else {
      throw new Error(`${path}.background must be "auto" or a #rrggbb colour`);
    }
  }
  return out;
}

/** Shape-checks parsed JSON and applies the documented defaults. Throws with a path. */
export function normaliseSettings(value: unknown): ImportSettings {
  if (!isRecord(value)) throw new Error('import settings must be a JSON object');
  if (value.version !== IMPORT_SETTINGS_VERSION) {
    throw new Error(`import settings version must be ${IMPORT_SETTINGS_VERSION}`);
  }
  if (!isRecord(value.sprites)) throw new Error('settings.sprites must be an object');
  const settings: ImportSettings = { version: IMPORT_SETTINGS_VERSION, sprites: {} };

  if (value.size !== undefined) {
    if (!isRecord(value.size)) throw new Error('settings.size must be an object');
    const size: { boss?: number; portrait?: number } = {};
    if (value.size.boss !== undefined) size.boss = integer(value.size.boss, 'settings.size.boss', 1);
    if (value.size.portrait !== undefined) size.portrait = integer(value.size.portrait, 'settings.size.portrait', 1);
    settings.size = size;
  }

  for (const [sprite, raw] of Object.entries(value.sprites)) {
    if (!isRecord(raw)) throw new Error(`settings.sprites.${sprite} must be an object`);
    const entry: RawSpriteSettings = {};
    for (const variant of VARIANTS) {
      if (raw[variant] !== undefined) entry[variant] = parseVariant(raw[variant], `settings.sprites.${sprite}.${variant}`);
    }
    if (raw.locked !== undefined) {
      if (!Array.isArray(raw.locked) || raw.locked.some((v) => !VARIANTS.includes(v as VariantName))) {
        throw new Error(`settings.sprites.${sprite}.locked must list variant names`);
      }
      entry.locked = raw.locked as VariantName[];
    }
    settings.sprites[sprite] = entry;
  }

  if (value.backdrop !== undefined) settings.backdrop = parseVariant(value.backdrop, 'settings.backdrop');
  return settings;
}

export function parseSettings(text: string): ImportSettings {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('import.json is not valid JSON');
  }
  return normaliseSettings(parsed);
}

/** Defaults merged with a written variant, ready for `importSprite`. */
export function resolveVariant(raw: RawVariantSettings | undefined): ResolvedVariantSettings {
  const merged = { ...DEFAULT_VARIANT, ...raw };
  const resolved: ResolvedVariantSettings = {
    colors: merged.colors,
    mode: merged.mode,
    palette: (merged.palette ?? []).map((hex) => parseHex(hex)!),
    background: merged.background === 'auto' ? 'auto' : parseHex(merged.background)!,
  };
  if (merged.crop) resolved.crop = merged.crop;
  return resolved;
}

/** Resolved settings -> the options `importSprite` takes. */
export function variantOptions(raw: RawVariantSettings | undefined, size: number, alphaThreshold = 128): ImportOptions {
  const settings = resolveVariant(raw);
  if (settings.mode === 'snap' && settings.palette.length === 0) {
    throw new Error('snap mode needs at least one palette colour');
  }
  const options: ImportOptions = {
    size,
    background: settings.background,
    paletteMode:
      settings.mode === 'extract'
        ? { kind: 'extract', colors: settings.colors }
        : { kind: 'snap', palette: settings.palette },
    alphaThreshold,
  };
  if (settings.crop) options.crop = settings.crop;
  return options;
}

/** The fragment the art bench downloads, in the same shape as import.json. */
export function settingsFragment(sprite: string, variant: VariantName, raw: RawVariantSettings): ImportSettings {
  const entry: RawSpriteSettings = {};
  entry[variant] = raw;
  return { version: IMPORT_SETTINGS_VERSION, sprites: { [sprite]: entry } };
}

/** Settings that reproduce the default import, for a first run with no import.json. */
export function defaultSettings(sprites: Iterable<string>): ImportSettings {
  const settings: ImportSettings = { version: IMPORT_SETTINGS_VERSION, sprites: {} };
  for (const sprite of [...sprites].sort()) settings.sprites[sprite] = {};
  return settings;
}
