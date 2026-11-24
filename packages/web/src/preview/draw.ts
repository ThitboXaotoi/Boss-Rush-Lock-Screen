// Canvas drawing for the preview: the rendered frame, then the fake iOS chrome and the
// layout check (brief D specs 5 and 6). The chrome is an approximation and is labelled as
// such on the page: colours come from palette.ts only, rectangles from overlay.ts, font
// sizes proportional to their rectangle. Drawing problems must never break the picture.
import { fit, neutrals } from '@boss-rush/core';
import type { BossState, Profile, Rgb, SceneState } from '@boss-rush/core';
import { hasSecretDate } from '@boss-rush/render';
import type { Frame } from '@boss-rush/render';
import { lockOverlay, zoneOverlays } from './overlay';
import type { CanvasRect, LockOverlay } from './overlay';
import { civilDateTime, formatDayWords, formatShortDate } from './time';

/** css() colour string for a palette entry (palette.ts is the only colour source). */
export function cssColor(c: Rgb): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export interface ChromeSwitches {
  statusBar: boolean;
  clock: boolean;
  widgets: boolean;
  notifications: boolean;
  buttons: boolean;
  layoutCheck: boolean;
}

export interface DrawInput {
  frame: Frame;
  profile: Profile;
  device: { width: number; height: number };
  /** Simulated time (epoch ms) the frame shows. */
  simEpoch: number;
  timeZone: string;
  scene: SceneState;
  switches: ChromeSwitches;
}

/** True when any part of the fake chrome is switched on. */
export function hasChrome(switches: ChromeSwitches): boolean {
  return (
    switches.statusBar ||
    switches.clock ||
    switches.widgets ||
    switches.notifications ||
    switches.buttons
  );
}

/** Blit the frame, then the enabled overlays. Chrome must never break the picture. */
export function drawPreview(canvas: HTMLCanvasElement, input: DrawInput): void {
  if (canvas.width !== input.frame.width) canvas.width = input.frame.width;
  if (canvas.height !== input.frame.height) canvas.height = input.frame.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(input.frame.rgba), input.frame.width, input.frame.height),
    0,
    0,
  );
  try {
    if (hasChrome(input.switches)) drawChrome(ctx, input, lockOverlay(input.profile, input.device));
    if (input.switches.layoutCheck) drawLayoutCheck(ctx, input);
  } catch {
    // The chrome is cosmetic: swallowing a drawing failure keeps the picture on screen.
  }
}

function drawChrome(ctx: CanvasRenderingContext2D, input: DrawInput, o: LockOverlay): void {
  if (input.switches.statusBar) drawStatusBar(ctx, o.statusBar);
  if (input.switches.clock) drawClock(ctx, o.clock, input.simEpoch, input.timeZone);
  if (input.switches.widgets) drawWidgets(ctx, o.widgets, input.scene, input.timeZone);
  if (input.switches.buttons) drawButtons(ctx, o.buttons);
  if (input.switches.notifications) drawNotifications(ctx, o.notifications, input.scene, input.timeZone);
}

function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  px: number,
  color: string,
  align: CanvasTextAlign = 'center',
  baseline: CanvasTextBaseline = 'middle',
): void {
  ctx.font = `${Math.max(1, Math.round(px))}px monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

/** `str` cut with an ellipsis when it would run past `maxWidth`. */
function fitted(ctx: CanvasRenderingContext2D, str: string, px: number, maxWidth: number): string {
  ctx.font = `${Math.max(1, Math.round(px))}px monospace`;
  if (ctx.measureText(str).width <= maxWidth) return str;
  let cut = str.length;
  while (cut > 1 && ctx.measureText(`${str.slice(0, cut)}…`).width > maxWidth) cut--;
  return `${str.slice(0, cut)}…`;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStatusBar(ctx: CanvasRenderingContext2D, r: CanvasRect): void {
  const white = cssColor(neutrals.white);
  // Signal bars, bottom-aligned on the left.
  const barW = Math.max(1, r.h * 0.14);
  const base = r.y + r.h * 0.78;
  ctx.fillStyle = white;
  for (let i = 0; i < 4; i++) {
    const h = r.h * (0.22 + 0.14 * i);
    ctx.fillRect(r.x + r.w * 0.03 + i * barW * 1.7, base - h, barW, h);
  }
  // Battery on the right: a body with a charge and a nub.
  const bodyW = r.h * 1.2;
  const bodyH = r.h * 0.5;
  const bx = r.x + r.w - r.w * 0.03 - bodyW - bodyH * 0.15;
  const by = r.y + r.h * 0.25;
  ctx.lineWidth = Math.max(1, r.h * 0.06);
  ctx.strokeStyle = white;
  ctx.strokeRect(bx, by, bodyW, bodyH);
  ctx.fillRect(bx + bodyW * 0.15, by + bodyH * 0.2, bodyW * 0.6, bodyH * 0.6);
  ctx.fillRect(bx + bodyW + ctx.lineWidth, by + bodyH * 0.3, bodyH * 0.15, bodyH * 0.4);
}

function drawClock(ctx: CanvasRenderingContext2D, r: CanvasRect, simEpoch: number, timeZone: string): void {
  const civil = civilDateTime(simEpoch, timeZone);
  const hours12 = civil.hour % 12 === 0 ? 12 : civil.hour % 12;
  const meridiem = civil.hour < 12 ? 'AM' : 'PM';
  text(ctx, `${hours12}:${String(civil.minute).padStart(2, '0')}`, r.x + r.w / 2, r.y + r.h * 0.4, r.h * 0.5, cssColor(neutrals.white));
  const line = fitted(ctx, `${meridiem} · ${formatDayWords(simEpoch, timeZone)}`, r.h * 0.18, r.w * 0.92);
  text(ctx, line, r.x + r.w / 2, r.y + r.h * 0.8, r.h * 0.18, cssColor(neutrals.fog));
}

function calendarLine(scene: SceneState, timeZone: string): string {
  const front = scene.front;
  if (!front) return 'No deadlines';
  if (hasSecretDate(front)) return `${front.short} due ???`; // secret date: never shown
  const ms = Date.parse(front.deadline);
  if (!Number.isFinite(ms)) return front.short;
  return `${front.short} due ${formatShortDate(ms, timeZone)}`;
}

function reminderLine(scene: SceneState, row: number): string {
  if (row === 1) return scene.nextStep ? `Next: ${scene.nextStep.label}` : 'No steps left';
  return 'Sample list · not real';
}

function drawWidgets(ctx: CanvasRenderingContext2D, r: CanvasRect, scene: SceneState, timeZone: string): void {
  // Panel behind the widgets so they read on any sky.
  roundRectPath(ctx, r.x, r.y, r.w, r.h, r.h * 0.12);
  ctx.fillStyle = cssColor(neutrals.ink);
  ctx.fill();
  const rowH = r.h / 3;
  const pad = rowH * 0.18;
  const font = rowH * 0.5;
  const midY = (i: number) => r.y + rowH * (i + 0.5);
  const left = r.x + pad + rowH * 0.6;
  const maxWidth = r.w - (left - r.x) - pad;
  // Calendar-style line: the front boss and its deadline.
  ctx.fillStyle = cssColor(neutrals.gold);
  ctx.fillRect(r.x + pad, midY(0) - rowH * 0.2, rowH * 0.4, rowH * 0.4);
  text(ctx, fitted(ctx, calendarLine(scene, timeZone), font, maxWidth), left, midY(0), font, cssColor(neutrals.white), 'left');
  // Reminders-style lines: the next step, clearly fake.
  ctx.strokeStyle = cssColor(neutrals.white);
  ctx.lineWidth = Math.max(1, font * 0.14);
  for (const i of [1, 2]) {
    ctx.beginPath();
    ctx.arc(r.x + pad + rowH * 0.2, midY(i), rowH * 0.2, 0, Math.PI * 2);
    ctx.stroke();
    text(ctx, fitted(ctx, reminderLine(scene, i), font, maxWidth), left, midY(i), font, cssColor(neutrals.white), 'left');
  }
}

function notificationLines(scene: SceneState, timeZone: string): { title: string; body: string }[] {
  const front: BossState | null = scene.front;
  const secret = front !== null && hasSecretDate(front); // secret date: never shown
  const left = !front ? '' : secret ? '???' : front.showHours ? `${front.hoursLeft} h` : `${front.daysLeft} d`;
  const due = !front ? '' : secret ? '???' : formatShortDate(Date.parse(front.deadline), timeZone);
  return [
    {
      title: 'BOSS RUSH',
      body: front ? `${front.short} · ${left} to the deadline` : 'Every deadline has passed',
    },
    { title: 'REMINDERS', body: scene.nextStep ? `Next: ${scene.nextStep.label}` : 'No steps left' },
    { title: 'CALENDAR', body: front ? `${front.short} due ${due}` : 'Nothing scheduled' },
  ];
}

function drawNotifications(
  ctx: CanvasRenderingContext2D,
  rects: CanvasRect[],
  scene: SceneState,
  timeZone: string,
): void {
  const lines = notificationLines(scene, timeZone);
  rects.forEach((r, i) => {
    roundRectPath(ctx, r.x, r.y, r.w, r.h, r.h * 0.18);
    ctx.fillStyle = cssColor(neutrals.ink);
    ctx.fill();
    const titleFont = r.h * 0.3;
    const bodyFont = r.h * 0.26;
    const maxWidth = r.w - r.w * 0.08;
    text(ctx, fitted(ctx, lines[i % lines.length]!.title, titleFont, maxWidth), r.x + r.w * 0.04, r.y + r.h * 0.32, titleFont, cssColor(neutrals.gold), 'left');
    text(ctx, fitted(ctx, lines[i % lines.length]!.body, bodyFont, maxWidth), r.x + r.w * 0.04, r.y + r.h * 0.68, bodyFont, cssColor(neutrals.fog), 'left');
  });
}

function drawButtons(ctx: CanvasRenderingContext2D, buttons: [CanvasRect, CanvasRect]): void {
  const slate = cssColor(neutrals.slate);
  const white = cssColor(neutrals.white);
  buttons.forEach((r, i) => {
    ctx.beginPath();
    ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0, Math.PI * 2);
    ctx.fillStyle = slate;
    ctx.fill();
    ctx.fillStyle = white;
    if (i === 0) {
      // Torch: a small upright bar.
      const barW = r.w * 0.16;
      roundRectPath(ctx, r.x + r.w / 2 - barW / 2, r.y + r.h * 0.26, barW, r.h * 0.42, barW / 2);
      ctx.fill();
    } else {
      // Camera: a ring with a dot.
      ctx.beginPath();
      ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = slate;
      ctx.beginPath();
      ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawLayoutCheck(ctx: CanvasRenderingContext2D, input: DrawInput): void {
  const f = fit(input.profile, input.device);
  const zones = zoneOverlays(input.profile, input.device);
  ctx.strokeStyle = cssColor(neutrals.gold);
  ctx.lineWidth = f.scale;
  for (const { rect } of zones) ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  // Names last, so they stay readable where zones touch.
  ctx.font = `${Math.max(8, f.scale * 5)}px monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.lineWidth = Math.max(1, f.scale * 0.75);
  for (const { name, rect } of zones) {
    const x = rect.x + f.scale;
    const y = rect.y + f.scale;
    ctx.strokeStyle = cssColor(neutrals.black);
    ctx.strokeText(name, x, y);
    ctx.fillStyle = cssColor(neutrals.white);
    ctx.fillText(name, x, y);
  }
}
