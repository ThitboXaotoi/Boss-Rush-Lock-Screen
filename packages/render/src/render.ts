// SceneState + Profile + Atlas -> pixels. Pure and deterministic.
// SHARED CONTRACT: the exported types and the render() signature are integrator-only.
// Brief B replaces the body of render() (and may add files next to this one).
//
// Output is a raw RGBA buffer so it runs identically in Node (golden tests) and the browser;
// PNG encoding happens at the edges (png.ts).
import { fit, neutrals, skyRamps } from '@boss-rush/core';
import type { Profile, Rect, Rgb, SceneState } from '@boss-rush/core';
import { drawSprite } from './layers/atlas';
import { drawGround, drawSky } from './layers/ground';
import { drawHero } from './layers/hero';
import { drawNamePlate, drawNext, drawTimer, hasSecretDate } from './layers/labels';
import { outlineBox } from './layers/pixels';
import { drawQueue } from './layers/queue';

/**
 * Sprite sheet at LOGICAL resolution (render scales the whole canvas, never single sprites).
 * Alpha is 0 or 255 only. Keys:
 *   `<sprite>_light`, `<sprite>_dark`, `_final`    front boss, square, the largest boss size
 *   `<sprite>_monster`                             optional last-24-hours picture
 *   `<sprite>_<variant>_<side>`                    native copy for a smaller profile zone side
 *   `<sprite>_portrait`                             queue portrait, square, the largest side
 *   (`backdrop` is no longer drawn: the sky is code-drawn and the ground comes from art/ground.ts)
 * Built by brief E (packages/tools/atlas).
 */
export interface Atlas {
  sprites: Record<string, { x: number; y: number; w: number; h: number }>;
  rgba: Uint8Array;
  width: number;
  height: number;
}

export interface Frame {
  width: number;
  height: number;
  /** RGBA, row-major, length = width * height * 4. Always fully opaque. */
  rgba: Uint8Array;
}

export interface RenderOptions {
  /** Output size in device pixels. */
  device: { width: number; height: number };
  /** Idle-animation frame for the web preview and motion exports. 0 = the still. */
  idleFrame?: number;
}

/** An atlas with no sprites, for hosts that have no art loaded yet. */
export const emptyAtlas: Atlas = { sprites: {}, rgba: new Uint8Array(0), width: 0, height: 0 };

function fillRect(buf: Uint8Array, stride: number, r: Rect, c: Rgb): void {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const i = (y * stride + x) * 4;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
      buf[i + 3] = 255;
    }
  }
}

/** Draw the duel at logical resolution, then scale and crop it to the device. */
export function render(
  scene: SceneState,
  profile: Profile,
  _atlas: Atlas,
  options: RenderOptions,
): Frame {
  const { width: lw, height: lh } = profile.logical;
  const logical = new Uint8Array(lw * lh * 4);
  const frame = { width: lw, height: lh, rgba: logical };
  const sky = skyRamps[scene.sky];
  const z = profile.zones;

  drawSky(frame, profile, scene.sky);
  drawGround(frame, profile, scene.sky);
  const { front } = scene;
  if (front) {
    drawQueue(frame, profile, _atlas, scene);
    const bob = [0, -1, -2, -1, 1, 2];
    const dy = bob[(options.idleFrame ?? 0) % bob.length] ?? 0;
    const monster = `${front.sprite}_monster`;
    // A plan can widen its `now` phase; the surprise is still only for the last 24 hours.
    const sprite = front.phase === 'now' && front.hoursLeft < 24 && _atlas.sprites[monster]
      ? monster
      : `${front.sprite}_${front.variant}`;
    drawSprite(frame, _atlas, sprite, z.boss, dy);
    drawNamePlate(frame, z.namePlate, front);
    drawTimer(frame, z.timer, hasSecretDate(front) ? 1 : scene.timer, front.phase);
  }
  drawHero(frame, z.hero, front?.phase === 'final' || front?.phase === 'now');
  if (front && scene.nextStep) drawNext(frame, z.nextLine, scene.nextStep);

  // Keep device chrome on plain sky, including when the atlas contains detail there.
  for (const zone of [z.statusBar, z.clock, z.widgets]) fillRect(logical, lw, zone, sky[1]);
  if (front && scene.widgetFrame) {
    const { x, y, w, h } = z.widgets;
    outlineBox(frame, z.widgets, neutrals.ink);
    outlineBox(frame, { x: x + 1, y: y + 1, w: w - 2, h: h - 2 }, neutrals.steel);
  }
  return scaleAndCrop(frame, profile, options.device);
}

/** Whole-number nearest-neighbour scale, then centre crop to the device size. */
export function scaleAndCrop(
  logical: Frame,
  profile: Profile,
  device: { width: number; height: number },
): Frame {
  const { scale, cropX, cropY } = fit(profile, device);
  const out = new Uint8Array(device.width * device.height * 4);
  for (let y = 0; y < device.height; y++) {
    const sy = Math.floor((y + cropY) / scale);
    for (let x = 0; x < device.width; x++) {
      const sx = Math.floor((x + cropX) / scale);
      const s = (sy * logical.width + sx) * 4;
      const d = (y * device.width + x) * 4;
      out[d] = logical.rgba[s]!;
      out[d + 1] = logical.rgba[s + 1]!;
      out[d + 2] = logical.rgba[s + 2]!;
      out[d + 3] = 255;
    }
  }
  return { width: device.width, height: device.height, rgba: out };
}
