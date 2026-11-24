// Format of the art data files in this folder. SHARED CONTRACT: integrator-only.
// The data files (hero.ts, font.ts) are filled by the owner from Gemini on the web
// (prompts in briefs/web/). No agent edits them.
import type { NeutralName } from '@boss-rush/core';

/**
 * A small sprite written as text. Each character in `rows` is a key of `colors`;
 * its value is a neutral colour name from palette.ts, or null for transparent.
 */
export interface PixelSprite {
  colors: Record<string, NeutralName | null>;
  rows: readonly string[];
}

/** Hero sprite size in logical pixels (square). */
export const HERO_SIZE = 48;
