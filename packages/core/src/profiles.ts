// Device and OS layout profiles. The ONLY place sizes and positions are defined.
// SHARED CONTRACT: integrator-only (see briefs/README.md). Layout: design/layout.md (Versus).
//
// Every number below is a PLACEHOLDER until spike S5 measures the real clock and widget
// positions on the owner's devices (SPIKES.md). Do not copy these numbers anywhere else.

export const PROFILE_NAMES = [
  'compact',
  'glass',
  'classic',
  'ipad',
  'legacy',
  'legacy-ipad',
] as const;
export type ProfileName = (typeof PROFILE_NAMES)[number];

/** Logical pixels, origin top-left. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Profile {
  name: ProfileName;
  logical: { width: number; height: number };
  /** Logical px on the left and right kept free of content (lost to the centre crop). */
  bleed: number;
  zones: {
    /** Status bar and Dynamic Island: nothing is drawn here. */
    statusBar: Rect;
    /** System clock and date: plain sky only. */
    clock: Rect;
    /** Lock screen widgets: plain sky, plus the optional pixel-art frame. */
    widgets: Rect;
    /** Left column of waiting bosses. */
    queue: Rect;
    /** Front boss sprite. Square; its side is the boss size. */
    boss: Rect;
    /** Short name and days left, under the boss. */
    namePlate: Rect;
    /** Round timer bar between boss and hero. */
    timer: Rect;
    /** Code-drawn hero. */
    hero: Rect;
    /** The single NEXT step line. */
    nextLine: Rect;
    /** Floor art only: bottom buttons and notifications cover it. */
    floor: Rect;
  };
  queue: {
    /** Waiting bosses shown before "+N more". Matches QUEUE_MAX in derive.ts. */
    slots: number;
    /** Portrait side in logical px. */
    portrait: number;
    /** Height of one slot: portrait plus its label line. */
    slotHeight: number;
  };
}

/** iOS 27, compact clock in the top row. The owner's main phone; first profile to be measured. */
export const compact: Profile = {
  name: 'compact',
  logical: { width: 180, height: 390 },
  bleed: 8,
  zones: {
    statusBar: { x: 0, y: 0, w: 180, h: 24 },
    clock: { x: 8, y: 24, w: 164, h: 32 },
    widgets: { x: 8, y: 58, w: 164, h: 40 },
    queue: { x: 8, y: 104, w: 48, h: 142 },
    boss: { x: 60, y: 104, w: 112, h: 112 },
    namePlate: { x: 60, y: 220, w: 112, h: 12 },
    timer: { x: 8, y: 250, w: 164, h: 9 },
    hero: { x: 16, y: 266, w: 48, h: 48 },
    nextLine: { x: 8, y: 322, w: 164, h: 9 },
    floor: { x: 0, y: 336, w: 180, h: 54 },
  },
  queue: { slots: 3, portrait: 32, slotHeight: 44 },
};

/** iOS 26. Same grid as `compact` with a taller clock; the duel moves down and the boss shrinks. */
export const glass: Profile = {
  name: 'glass',
  logical: { width: 180, height: 390 },
  bleed: 8,
  zones: {
    statusBar: { x: 0, y: 0, w: 180, h: 24 },
    clock: { x: 8, y: 24, w: 164, h: 62 },
    widgets: { x: 8, y: 88, w: 164, h: 40 },
    queue: { x: 8, y: 134, w: 64, h: 124 },
    boss: { x: 76, y: 134, w: 96, h: 96 },
    namePlate: { x: 76, y: 234, w: 96, h: 12 },
    timer: { x: 8, y: 262, w: 164, h: 9 },
    hero: { x: 16, y: 274, w: 48, h: 48 },
    nextLine: { x: 8, y: 322, w: 164, h: 9 },
    floor: { x: 0, y: 336, w: 180, h: 54 },
  },
  queue: { slots: 3, portrait: 28, slotHeight: 40 },
};

/** iOS 16 to 18, large fixed clock. Exported but untested (no such device with the owner). */
export const classic: Profile = { ...glass, name: 'classic' };

/** `ipad`, `legacy` and `legacy-ipad` are added by brief H. */
export const profiles: Partial<Record<ProfileName, Profile>> = { compact, glass, classic };

export const DEFAULT_PROFILE: ProfileName = 'compact';

export interface Fit {
  /** Whole-number scale from logical to device pixels. */
  scale: number;
  /** Device pixels cropped from the left (and right) of the scaled canvas. */
  cropX: number;
  /** Device pixels cropped from the top (and bottom) of the scaled canvas. */
  cropY: number;
}

/**
 * The one scaling rule (AGENTS.md): the smallest whole-number scale that covers the device,
 * then a centre crop. Render, preview overlays and the calibration grid must all use this.
 */
export function fit(profile: Profile, device: { width: number; height: number }): Fit {
  const { width, height } = profile.logical;
  const scale = Math.max(1, Math.ceil(Math.max(device.width / width, device.height / height)));
  return {
    scale,
    cropX: Math.floor((width * scale - device.width) / 2),
    cropY: Math.floor((height * scale - device.height) / 2),
  };
}
