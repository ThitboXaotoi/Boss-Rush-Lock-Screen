// Calibration grid wallpaper for spike S5: set it on the phone, screenshot, read off where the
// clock, widgets, notifications and buttons sit, in logical pixels.
// SHARED CONTRACT: the renderGrid() signature is integrator-only. Brief B owns the body and
// adds the number labels and zone names once the 5x7 font exists.
import { neutrals } from '@boss-rush/core';
import type { Profile, Rect, Rgb } from '@boss-rush/core';
import { drawGridGuides, MAJOR_STEP, MINOR_STEP } from './layers/gridGuides';
import { scaleAndCrop } from './render';
import type { Frame } from './render';

function plot(buf: Uint8Array, stride: number, x: number, y: number, c: Rgb): void {
  const i = (y * stride + x) * 4;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
  buf[i + 3] = 255;
}

function outline(buf: Uint8Array, stride: number, r: Rect, c: Rgb): void {
  for (let x = r.x; x < r.x + r.w; x++) {
    plot(buf, stride, x, r.y, c);
    plot(buf, stride, x, r.y + r.h - 1, c);
  }
  for (let y = r.y; y < r.y + r.h; y++) {
    plot(buf, stride, r.x, y, c);
    plot(buf, stride, r.x + r.w - 1, y, c);
  }
}

/** Lines every 10 logical px (brighter every 50), bleed columns in red, zone outlines in gold. */
export function renderGrid(profile: Profile, device: { width: number; height: number }): Frame {
  const { width: w, height: h } = profile.logical;
  const buf = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const major = x % MAJOR_STEP === 0 || y % MAJOR_STEP === 0;
      const minor = x % MINOR_STEP === 0 || y % MINOR_STEP === 0;
      const inBleed = x < profile.bleed || x >= w - profile.bleed;
      plot(
        buf,
        w,
        x,
        y,
        major ? neutrals.fog : minor ? neutrals.slate : inBleed ? neutrals.warning : neutrals.black,
      );
    }
  }
  for (const zone of Object.values(profile.zones)) outline(buf, w, zone, neutrals.gold);
  drawGridGuides({ width: w, height: h, rgba: buf }, profile, device);
  return scaleAndCrop({ width: w, height: h, rgba: buf }, profile, device);
}
