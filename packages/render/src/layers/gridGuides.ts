import { fit, neutrals } from '@boss-rush/core';
import type { Fit, Profile, Rect, Rgb } from '@boss-rush/core';
import { drawText, GLYPH_H, textWidth } from '../font5x7';
import type { Frame } from '../render';
import { fillBox } from './pixels';

export const MINOR_STEP = 10;
export const MAJOR_STEP = 50;
const MAJOR_TICK = 4;
const MINOR_TICK = 2;
const EDGE_ROWS = 15;

function tag(frame: Frame, label: string, box: Rect, colour: Rgb): void {
  fillBox(frame, box, neutrals.black);
  drawText(frame.rgba, frame.width, box.x, box.y, label, colour);
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function visibleRect({ scale, cropX, cropY }: Fit, device: { width: number; height: number }): Rect {
  // Use only logical pixels that survive the crop in full.
  const x = Math.ceil(cropX / scale);
  const y = Math.ceil(cropY / scale);
  const right = Math.floor((cropX + device.width) / scale);
  const bottom = Math.floor((cropY + device.height) / scale);
  return { x, y, w: right - x, h: bottom - y };
}

export function drawGridGuides(frame: Frame, profile: Profile, device: { width: number; height: number }): void {
  const { x: left, y: top, w, h } = visibleRect(fit(profile, device), device);
  const right = left + w;
  const bottom = top + h;
  const labelY = Math.min(bottom, frame.height - EDGE_ROWS) - GLYPH_H;
  const axisY = labelY - 1;
  if (right <= left || axisY < top + MAJOR_TICK) return;

  // Put the X axis above the bottom crop margin so it doesn't compete with the status label.
  fillBox(frame, { x: left, y: axisY, w, h: 1 }, neutrals.steel);
  fillBox(frame, { x: left, y: top, w: 1, h }, neutrals.steel);

  for (let x = Math.ceil(left / MINOR_STEP) * MINOR_STEP; x < right; x += MINOR_STEP) {
    const major = x % MAJOR_STEP === 0;
    const length = major ? MAJOR_TICK : MINOR_TICK;
    fillBox(frame, { x, y: axisY - length + 1, w: 1, h: length }, major ? neutrals.white : neutrals.fog);
    if (!major) continue;
    const label = String(x);
    const tw = textWidth(label);
    const tx = Math.max(left + MAJOR_TICK + 1, Math.min(right - tw, x - Math.floor(tw / 2)));
    if (tx + tw > right) continue;
    tag(frame, label, { x: tx, y: labelY, w: tw, h: GLYPH_H }, neutrals.white);
  }

  const yTags: Rect[] = [];
  const axisTop = axisY - MAJOR_TICK + 1;
  for (let y = Math.ceil(top / MINOR_STEP) * MINOR_STEP; y < bottom; y += MINOR_STEP) {
    const major = y % MAJOR_STEP === 0;
    const length = major ? MAJOR_TICK : MINOR_TICK;
    fillBox(frame, { x: left, y, w: Math.min(length, w), h: 1 }, major ? neutrals.white : neutrals.fog);
    if (!major) continue;
    const label = String(y);
    const tw = textWidth(label);
    const tx = left + MAJOR_TICK + 1;
    const ty = Math.max(top, y - Math.floor(GLYPH_H / 2));
    if (tx + tw > right || ty + GLYPH_H > axisTop) continue;
    const box = { x: tx, y: ty, w: tw, h: GLYPH_H };
    tag(frame, label, box, neutrals.white);
    yTags.push(box);
  }

  for (const [name, zone] of Object.entries(profile.zones)) {
    const label = name.replace(/[A-Z]/g, ' $&').toUpperCase();
    const tw = textWidth(label);
    const x0 = Math.max(left, zone.x + 1);
    const x1 = Math.min(right, zone.x + zone.w - 1) - tw;
    const y0 = Math.max(top, EDGE_ROWS, zone.y + 1);
    const y1 = Math.min(axisTop, zone.y + zone.h - 1) - GLYPH_H;
    if (x0 > x1 || y0 > y1) continue;
    const positions = [Math.floor((y0 + y1) / 2), y0, y1];
    const x = Math.floor((x0 + x1) / 2);
    const box = positions
      .map(y => ({ x, y, w: tw, h: GLYPH_H }))
      .find(box => !yTags.some(other => intersects(box, other)));
    if (box) tag(frame, label, box, neutrals.gold);
  }
}
