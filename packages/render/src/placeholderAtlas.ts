import { neutrals } from '@boss-rush/core';
import type { Profile, Rect } from '@boss-rush/core';
import type { Atlas } from './render';

const inks = {
  light: { edge: neutrals.ink, body: neutrals.steel, mark: neutrals.white },
  dark: { edge: neutrals.black, body: neutrals.slate, mark: neutrals.fog },
  final: { edge: neutrals.ink, body: neutrals.warning, mark: neutrals.gold },
  portrait: { edge: neutrals.ink, body: neutrals.steel, mark: neutrals.white },
};
const kinds = ['light', 'dark', 'final', 'portrait'] as const;

function fingerprint(name: string): number {
  let hash = 2166136261; // FNV-1a
  for (const ch of name) hash = Math.imul(hash ^ ch.codePointAt(0)!, 16777619);
  return hash >>> 0;
}

function drawStandIn(
  atlas: Atlas,
  box: Rect,
  seed: number,
  kind: (typeof kinds)[number],
): void {
  const cx = (box.w - 1) / 2;
  const cy = (box.h - 1) / 2;
  const boost = kind === 'final' ? 1 : 0;
  // The seed determines a simple chamfered silhouette, not just its colour.
  const rx = box.w * (5 + (seed & 3) + boost) / 20;
  const ry = box.h * (5 + ((seed >>> 2) & 3) + boost) / 20;
  const cut = Math.min(rx, ry) * ((seed >>> 4) & 7) / 8;
  const inside = (x: number, y: number) => {
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);
    return dx <= rx && dy <= ry && dx + dy <= rx + ry - cut;
  };
  const markSize = Math.min(rx, ry) / 4;
  const c = inks[kind];

  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const mark = Math.abs(x - cx) + Math.abs(y - cy) <= markSize;
      const p = ((box.y + y) * atlas.width + box.x + x) * 4;
      atlas.rgba.set(edge ? c.edge : mark ? c.mark : c.body, p);
      atlas.rgba[p + 3] = 255;
    }
  }
}

/** Deterministic stand-ins for local previews and tests; not finished game art. */
export function placeholderAtlas(profile: Profile, sprites: Iterable<string>): Atlas {
  const names = [...new Set(sprites)].sort();
  const { w, h } = profile.zones.boss;
  const { portrait } = profile.queue;
  const rowHeight = Math.max(h, portrait);
  const width = names.length ? (kinds.length - 1) * w + portrait : 0;
  const height = names.length * rowHeight;
  const atlas: Atlas = { width, height, sprites: {}, rgba: new Uint8Array(width * height * 4) };

  names.forEach((name, row) => {
    const seed = fingerprint(name);
    let x = 0;
    for (const kind of kinds) {
      const box = { x, y: row * rowHeight, w: kind === 'portrait' ? portrait : w, h: kind === 'portrait' ? portrait : h };
      atlas.sprites[`${name}_${kind}`] = box;
      drawStandIn(atlas, box, seed, kind);
      x += box.w;
    }
  });
  return atlas;
}
