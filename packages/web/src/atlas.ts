// The sprite atlas used by preview and exporters.
// SHARED FILE: integrator-only.
//
// Real art comes from brief E's import (`bun run --filter @boss-rush/tools art:import`), which writes
// art/export/atlas.json + atlas.png. Both are bundled into the app at build time.
//
// Production build (the submitted link): real art only. A boss is shown only when its art is
// complete (light, dark, final, portrait); the others are hidden (owner, Nov 16 and Nov 22).
// Development (`bun run dev`): real art where it exists, code-drawn stand-ins (brief B) for the rest,
// so every screen looks complete while working.
import { DEFAULT_PROFILE, profiles } from '@boss-rush/core';
import { decodePng, placeholderAtlas } from '@boss-rush/render';
import type { Atlas } from '@boss-rush/render';
import atlasJson from '../../../art/export/atlas.json';
import atlasPng from '../../../art/export/atlas.png?inline';
import { getPlan } from './store';

const DEV = import.meta.env.DEV;
const VARIANTS = ['light', 'dark', 'final', 'portrait'] as const;

function loadReal(): Atlas {
  const base64 = atlasPng.slice(atlasPng.indexOf(',') + 1);
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const { width, height, rgba } = decodePng(bytes);
  return { sprites: atlasJson.sprites as Atlas['sprites'], rgba, width, height };
}

const real = loadReal();

/** Sprite prefixes whose four variants are all in the real atlas. */
const complete: ReadonlySet<string> = new Set(
  Object.keys(real.sprites)
    .map((key) => key.replace(/_(light|dark|final|portrait)$/, ''))
    .filter((prefix) => VARIANTS.every((v) => `${prefix}_${v}` in real.sprites)),
);

/** `a` on top of `b` in one buffer; `a`'s sprites win on a name clash. */
function stack(a: Atlas, b: Atlas): Atlas {
  const width = Math.max(a.width, b.width);
  const height = a.height + b.height;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < a.height; y++) {
    rgba.set(a.rgba.subarray(y * a.width * 4, (y + 1) * a.width * 4), y * width * 4);
  }
  for (let y = 0; y < b.height; y++) {
    rgba.set(b.rgba.subarray(y * b.width * 4, (y + 1) * b.width * 4), (a.height + y) * width * 4);
  }
  const sprites: Atlas['sprites'] = {};
  for (const [k, r] of Object.entries(b.sprites)) sprites[k] = { ...r, y: r.y + a.height };
  Object.assign(sprites, a.sprites);
  return { sprites, rgba, width, height };
}

let cache: { key: string; atlas: Atlas } | null = null;

export function getAtlas(): Atlas {
  if (!DEV) return real;
  const plan = getPlan();
  const profile =
    profiles[plan.settings.profile as keyof typeof profiles] ?? profiles[DEFAULT_PROFILE]!;
  const missing = plan.bosses.map((b) => b.sprite).filter((s) => !complete.has(s));
  const key = `${profile.name}|${missing.join(',')}`;
  if (cache?.key !== key) {
    cache = { key, atlas: missing.length ? stack(real, placeholderAtlas(profile, missing)) : real };
  }
  return cache.atlas;
}

/**
 * Sprite prefixes with finished art, for derive()'s `availableSprites`.
 * `undefined` in development (stand-ins fill the gaps, show every boss); in production, the bosses
 * whose real art is complete.
 */
export function availableSprites(): ReadonlySet<string> | undefined {
  return DEV ? undefined : complete;
}
