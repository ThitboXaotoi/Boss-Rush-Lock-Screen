// Overlay rectangles for the preview: zone rects mapped to canvas pixels through fit(),
// the same scale-and-crop rule the renderer uses (design/layout.md, "For agents").
// The fake iOS chrome is an approximation (brief D, "Careful"): its parts sit ON the zones
// (status bar, clock, widgets) or are anchored to the canvas like the real lock screen
// (notifications, bottom buttons). profiles.ts models only the game canvas, so the chrome's
// own proportions live here as named fractions of the canvas, never absolute pixels.
import { fit } from '@boss-rush/core';
import type { Profile, Rect } from '@boss-rush/core';

/** Pixels of the preview canvas. */
export interface CanvasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ZoneName = keyof Profile['zones'];

export const ZONE_NAMES = [
  'statusBar',
  'clock',
  'widgets',
  'queue',
  'boss',
  'namePlate',
  'timer',
  'hero',
  'nextLine',
  'floor',
] as const satisfies readonly ZoneName[];

/** A zone rectangle in canvas pixels: the `fit()` scale, then the centre crop. */
export function zoneToCanvas(
  zone: Rect,
  profile: Profile,
  device: { width: number; height: number },
): CanvasRect {
  const { scale, cropX, cropY } = fit(profile, device);
  return {
    x: zone.x * scale - cropX,
    y: zone.y * scale - cropY,
    w: zone.w * scale,
    h: zone.h * scale,
  };
}

export interface ZoneOverlay {
  name: ZoneName;
  rect: CanvasRect;
}

/** Every zone with its canvas rectangle, for the layout check (brief D spec 6). */
export function zoneOverlays(
  profile: Profile,
  device: { width: number; height: number },
): ZoneOverlay[] {
  return ZONE_NAMES.map((name) => ({ name, rect: zoneToCanvas(profile.zones[name], profile, device) }));
}

// Fake chrome proportions, relative to the canvas (the real lock screen's look).
// If these belong in profiles.ts instead, that is a shared-file request (status file).

/** Torch and camera button side, relative to the canvas width. */
const BUTTON_FRACTION = 0.12;
/** One notification's height, relative to the canvas height. */
const NOTIFICATION_FRACTION = 0.055;
/** Gap between notifications, relative to the canvas height. */
const NOTIFICATION_GAP_FRACTION = 0.012;
/** Notification inset from the left and right, relative to the canvas width. */
const NOTIFICATION_INSET_FRACTION = 0.04;
/** Sample notifications stacking up from the bottom (brief D spec 5: "two or three"). */
export const NOTIFICATION_COUNT = 3;

export interface LockOverlay {
  statusBar: CanvasRect;
  clock: CanvasRect;
  widgets: CanvasRect;
  /** Sample notifications, bottom first (they stack up from the bottom). */
  notifications: CanvasRect[];
  /** Torch and camera buttons, [left, right]. */
  buttons: [CanvasRect, CanvasRect];
}

/**
 * Rectangles of the fake iOS chrome (brief D spec 5). Clock, status bar and widgets sit
 * exactly on their zones; notifications and buttons stack up from the canvas bottom, the
 * region `design/layout.md` reserves for them (the floor zone).
 */
export function lockOverlay(
  profile: Profile,
  device: { width: number; height: number },
): LockOverlay {
  const side = device.width * BUTTON_FRACTION;
  const buttons: [CanvasRect, CanvasRect] = [
    { x: side * 0.6, y: device.height - side, w: side, h: side },
    { x: device.width - side * 1.6, y: device.height - side, w: side, h: side },
  ];
  const height = device.height * NOTIFICATION_FRACTION;
  const gap = device.height * NOTIFICATION_GAP_FRACTION;
  const inset = device.width * NOTIFICATION_INSET_FRACTION;
  const notifications: CanvasRect[] = [];
  for (let i = 0; i < NOTIFICATION_COUNT; i++) {
    notifications.push({
      x: inset,
      y: device.height - side - gap - (i + 1) * (height + gap),
      w: device.width - inset * 2,
      h: height,
    });
  }
  return {
    statusBar: zoneToCanvas(profile.zones.statusBar, profile, device),
    clock: zoneToCanvas(profile.zones.clock, profile, device),
    widgets: zoneToCanvas(profile.zones.widgets, profile, device),
    notifications,
    buttons,
  };
}
