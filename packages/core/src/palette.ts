// The ONLY place colours are defined (AGENTS.md hard rule).
// SHARED CONTRACT: integrator-only (see briefs/README.md).
//
// All values are PLACEHOLDERS until the owner settles the palette (design/art.md, "Palette").
// The structure supports both options still open there:
//   - "colours from the art": the import tool writes each boss's colours to palette.bosses.ts;
//   - "snap to a chosen palette": the owner's palette replaces the values here and the tool
//     snaps every sprite to it.
import type { Sky } from './derive';
import { bossRamps } from './palette.bosses';
import { groundRamps } from './palette.ground';

export type Rgb = readonly [r: number, g: number, b: number];

/** Shared neutrals for UI, text, the hero and the floor. */
export const neutrals = {
  black: [0x0b, 0x0b, 0x14],
  ink: [0x1c, 0x1c, 0x2e],
  slate: [0x3a, 0x3f, 0x5c],
  steel: [0x6b, 0x72, 0x94],
  fog: [0xa9, 0xb0, 0xc8],
  white: [0xf4, 0xf4, 0xf4],
  warning: [0xe8, 0x3b, 0x3b],
  gold: [0xf2, 0xc1, 0x4e],
  /** Dark red for the hero's scarf and cloak lining (owner art, Nov 22). */
  maroon: [0x8a, 0x1f, 0x2b],
} as const satisfies Record<string, Rgb>;

export type NeutralName = keyof typeof neutrals;

/**
 * Four-step ramp per sky, darkest first. The backdrop is imported against the `day` ramp;
 * render swaps it for the other skies by index, so the four ramps must stay the same length.
 */
export const skyRamps = {
  dawn: [
    [0x2b, 0x21, 0x4a],
    [0x6a, 0x3d, 0x6e],
    [0xc9, 0x6b, 0x6b],
    [0xf6, 0xb0, 0x7a],
  ],
  day: [
    [0x1f, 0x3b, 0x6e],
    [0x3a, 0x6e, 0xa5],
    [0x6f, 0xa8, 0xd6],
    [0xbf, 0xe0, 0xf2],
  ],
  dusk: [
    [0x1a, 0x16, 0x3a],
    [0x45, 0x2a, 0x5e],
    [0x8a, 0x3f, 0x6b],
    [0xd9, 0x6c, 0x4f],
  ],
  night: [
    [0x05, 0x06, 0x12],
    [0x0e, 0x12, 0x2b],
    [0x1b, 0x23, 0x4a],
    [0x34, 0x40, 0x7a],
  ],
} as const satisfies Record<Sky, readonly [Rgb, Rgb, Rgb, Rgb]>;

/** Kept for existing imports: the neutrals under their old name. */
export const palette = neutrals;
export type PaletteColor = NeutralName;

export { bossRamps, groundRamps };

/** Integrator-drawn clouds over the owner's ground (owner, Nov 22): [cloud, shade] per sky. */
export const cloudRamps = {
  dawn: [
    [0xf6, 0xc8, 0xc0],
    [0xd9, 0x8f, 0x8f],
  ],
  day: [
    [0xf4, 0xf4, 0xf4],
    [0xbf, 0xd0, 0xe0],
  ],
  dusk: [
    [0xe8, 0x9a, 0x7a],
    [0xa8, 0x5a, 0x6e],
  ],
  night: [
    [0x2a, 0x30, 0x58],
    [0x1b, 0x20, 0x40],
  ],
} as const satisfies Record<Sky, readonly [Rgb, Rgb]>;

/** Every colour a pixel may use. The palette lint (brief E) checks sprites against this. */
export function allColors(): Rgb[] {
  return [
    ...Object.values(neutrals),
    ...Object.values(skyRamps).flat(),
    ...Object.values(bossRamps).flat(),
    ...Object.values(groundRamps).flat(),
    ...Object.values(cloudRamps).flat(),
  ];
}
