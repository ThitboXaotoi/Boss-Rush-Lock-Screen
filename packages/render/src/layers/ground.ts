// Sky and ground (owner, Nov 22: the owner's Gemini ground under a code-drawn sky with low clouds).
// Sky bands are derived from existing zones, so no new layout numbers: the top band covers the
// device chrome (same colour the chrome zones are kept at), then lighter bands toward the horizon.
import { cloudRamps, groundRamps, skyRamps } from '@boss-rush/core';
import type { Profile, Rgb, Sky } from '@boss-rush/core';
import { ground } from '../art/ground';
import type { Frame } from '../render';

function fillRows(frame: Frame, y0: number, y1: number, c: Rgb): void {
  for (let y = Math.max(0, y0); y < Math.min(frame.height, y1); y++) {
    for (let x = 0; x < frame.width; x++) {
      const i = (y * frame.width + x) * 4;
      frame.rgba[i] = c[0];
      frame.rgba[i + 1] = c[1];
      frame.rgba[i + 2] = c[2];
      frame.rgba[i + 3] = 255;
    }
  }
}

/**
 * Horizon: the row where the raised ridge meets the far fields (owner, Nov 23: the boss stands on
 * the land). Derived from the boss zone like the sky bands: a sixteenth of the boss's height above
 * the bottom of the boss zone, so the boss's feet land just in front of the ridge.
 */
export function horizonRow(profile: Profile): number {
  const { boss } = profile.zones;
  return boss.y + boss.h - Math.floor(boss.h / 16);
}

/** Sky colour of logical row `y` (before ground and clouds): three bands, lighter downward, ending at the horizon. */
export function skyColourAt(profile: Profile, sky: Sky, y: number): Rgb {
  const ramp = skyRamps[sky];
  const { boss } = profile.zones;
  if (y < boss.y + Math.floor(boss.h / 2)) return ramp[1];
  if (y < boss.y + Math.floor((boss.h * 3) / 4)) return ramp[2];
  return ramp[3];
}

export function drawSky(frame: Frame, profile: Profile, sky: Sky): void {
  for (let y = 0; y < frame.height; y++) fillRows(frame, y, y + 1, skyColourAt(profile, sky, y));
}

/**
 * The ground art splits into the ridge (clouds, foothills and their dark base: every row down to
 * the first fully opaque row with field colours 2-9) and the field below it (path, trees, grass). The field keeps its
 * place against the bottom edge; the ridge is lifted so its base sits on the horizon.
 */
const FIELD_START = ground.findIndex((row) => !row.includes('.') && /[2-9]/.test(row));

/** Far fields between the ridge and the field: ramp index per band, haziest first. */
const FAR_BANDS = [8, 7, 6, 5] as const;
/** Hedgerow ramp index: a few darker pixels along each far band's top edge. */
const HEDGE = 2;

function put(frame: Frame, x: number, y: number, c: Rgb): void {
  if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return;
  const i = (y * frame.width + x) * 4;
  frame.rgba[i] = c[0];
  frame.rgba[i + 1] = c[1];
  frame.rgba[i + 2] = c[2];
  frame.rgba[i + 3] = 255;
}

function drawRows(frame: Frame, sky: Sky, rows: readonly string[], top: number): void {
  const colours = groundRamps[sky];
  const [cloud, shade] = cloudRamps[sky];
  rows.forEach((row, j) => {
    for (let x = 0; x < Math.min(row.length, frame.width); x++) {
      const ch = row[x]!;
      const c: Rgb | undefined =
        ch === '.' ? undefined : ch === 'c' ? cloud : ch === 'C' ? shade : colours[Number(ch)];
      if (c) put(frame, x, top + j, c);
    }
  });
}

export function drawGround(frame: Frame, profile: Profile, sky: Sky): void {
  const colours = groundRamps[sky];
  const fieldTop = frame.height - ground.length + FIELD_START;
  const horizon = Math.min(horizonRow(profile), fieldTop);
  // Far fields: bands growing taller toward the viewer (1, 2, 3, 4 parts of the gap).
  const gap = fieldTop - horizon;
  const parts = (FAR_BANDS.length * (FAR_BANDS.length + 1)) / 2;
  let y = horizon;
  FAR_BANDS.forEach((ramp, b) => {
    const end = b === FAR_BANDS.length - 1 ? fieldTop : y + Math.round((gap * (b + 1)) / parts);
    fillRows(frame, y, end, colours[ramp]!);
    // Sparse hedgerow: a deterministic dotted line on the band's top row (none on the first band).
    if (b > 0 && end - y > 2) {
      for (let x = (b * 7) % 11; x < frame.width; x += 5 + ((x * 3 + b) % 7)) {
        put(frame, x, y, colours[HEDGE]!);
        put(frame, x + 1, y, colours[HEDGE]!);
      }
    }
    y = end;
  });
  drawRows(frame, sky, ground.slice(0, FIELD_START), horizon - FIELD_START);
  drawRows(frame, sky, ground.slice(FIELD_START), fieldTop);
}
