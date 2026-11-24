// Contest cover: three phones side by side showing the same boss as Light (day),
// Dark (night) and Final form, on a plain palette background. Deterministic for a
// given plan: the reference instant comes from the plan's own deadlines, never the
// clock. (The 5x7 title arrives once brief B exports a text API; until then, phones
// only. The composition keeps a fixed layout so the title slot stays stable.)
import { derive, fixtureScenes, neutrals } from '@boss-rush/core';
import type { Plan, SceneState, Sky, Variant } from '@boss-rush/core';
import type { Frame } from '@boss-rush/render';

export const COVER_WIDTH = 2400;
export const COVER_HEIGHT = 1600;
/** Each phone render, in device pixels. Close to the compact aspect so little crops. */
export const COVER_PHONE = { width: 640, height: 1400 } as const;
/** Margin around the row and gap between phones: 4 x 120 + 3 x 640 = 2400. */
export const COVER_GAP = 120;
const COVER_TOP = (COVER_HEIGHT - COVER_PHONE.height) / 2;

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDeadline(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
}

/** Earliest dated deadline still in the future at `now`, or undefined. */
function nextDeadline(plan: Plan, now: number): number | undefined {
  let best: number | undefined;
  for (const boss of plan.bosses) {
    if (boss.deadline === null) continue;
    const at = parseDeadline(boss.deadline);
    if (!Number.isFinite(at) || at <= now) continue;
    if (best === undefined || at < best) best = at;
  }
  return best;
}

function withSkyAndVariant(scene: SceneState, sky: Sky, variant: Variant): SceneState {
  return {
    ...scene,
    sky,
    front: scene.front === null ? null : { ...scene.front, variant },
  };
}

/**
 * The three cover scenes: the same front boss as Light on day, Dark on night and
 * Final form. The reference instant is ten days before the nearest future deadline;
 * with no future deadline the fixed fixture scenes are used, so the cover never
 * depends on when it is built.
 */
export function coverScenes(
  plan: Plan,
  now: number,
  availableSprites?: ReadonlySet<string>,
): [SceneState, SceneState, SceneState] {
  const next = nextDeadline(plan, now);
  let base: SceneState;
  if (next === undefined) {
    base = fixtureScenes.farDay;
  } else {
    try {
      base = derive(plan, next - 10 * DAY_MS, { availableSprites });
    } catch {
      base = fixtureScenes.farDay;
    }
  }
  if (base.front === null) base = fixtureScenes.farDay;
  return [
    withSkyAndVariant(base, 'day', 'light'),
    withSkyAndVariant(base, 'night', 'dark'),
    withSkyAndVariant(base, 'dusk', 'final'),
  ];
}

/** Blit the three phone frames onto the cover background. */
export function composeCover(panels: readonly [Frame, Frame, Frame]): Frame {
  const rgba = new Uint8Array(COVER_WIDTH * COVER_HEIGHT * 4);
  const [br, bg, bb] = neutrals.black;
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = br!;
    rgba[i + 1] = bg!;
    rgba[i + 2] = bb!;
    rgba[i + 3] = 255;
  }
  panels.forEach((panel, index) => {
    const dx = COVER_GAP + index * (COVER_PHONE.width + COVER_GAP);
    const dy = COVER_TOP;
    const w = Math.min(panel.width, COVER_PHONE.width);
    const h = Math.min(panel.height, COVER_PHONE.height);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const s = (y * panel.width + x) * 4;
        const d = ((dy + y) * COVER_WIDTH + (dx + x)) * 4;
        rgba[d] = panel.rgba[s]!;
        rgba[d + 1] = panel.rgba[s + 1]!;
        rgba[d + 2] = panel.rgba[s + 2]!;
        rgba[d + 3] = 255;
      }
    }
  });
  return { width: COVER_WIDTH, height: COVER_HEIGHT, rgba };
}
