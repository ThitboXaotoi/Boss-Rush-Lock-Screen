import { neutrals } from '@boss-rush/core';
import type { Rect } from '@boss-rush/core';
import { hero, heroReady } from '../art/hero';
import { HERO_SIZE } from '../art/types';
import type { Frame } from '../render';
import { fillBox } from './pixels';

/** `ready`: the battle-ready pose, used in the last days before the front deadline. */
export function drawHero(frame: Frame, zone: Rect, ready = false): void {
  const sprite = ready ? heroReady : hero;
  const scale = Math.floor(Math.min(zone.w, zone.h) / HERO_SIZE);
  if (scale < 1) return;

  const x = zone.x + Math.floor((zone.w - HERO_SIZE * scale) / 2);
  // Use the last visible row as the baseline, even when the art has bottom padding.
  let rows = HERO_SIZE;
  while (rows > 0 && ![...sprite.rows[rows - 1]!].some(ch => sprite.colors[ch] != null)) rows--;
  const y = zone.y + zone.h - rows * scale;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < HERO_SIZE; col++) {
      const colour = sprite.colors[sprite.rows[row]![col]!];
      if (colour == null) continue;
      fillBox(frame, { x: x + col * scale, y: y + row * scale, w: scale, h: scale }, neutrals[colour]);
    }
  }
}
