import { neutrals } from '@boss-rush/core';
import type { Profile, SceneState } from '@boss-rush/core';
import { GLYPH_H } from '../font5x7';
import type { Atlas, Frame } from '../render';
import { drawSprite } from './atlas';
import { drawLabel, queueLabel } from './labels';

export function drawQueue(frame: Frame, profile: Profile, atlas: Atlas, scene: SceneState): void {
  const { x, y, w, h } = profile.zones.queue;
  const { slots, portrait, slotHeight } = profile.queue;
  const entries = scene.queue.slice(0, slots);
  const overflow = scene.queueOverflow + scene.queue.length - entries.length;
  const labelsBottom = y + h - (overflow > 0 ? GLYPH_H : 0);

  entries.forEach((boss, i) => {
    const top = y + i * slotHeight;
    const bottom = Math.min(top + slotHeight, labelsBottom);
    const side = Math.min(w, portrait, bottom - top - GLYPH_H);
    if (side > 0) {
      drawSprite(frame, atlas, `${boss.sprite}_portrait`, { x, y: top, w: side, h: side });
    }
    const textY = top + Math.max(0, side);
    drawLabel(frame, { x, y: textY, w, h: bottom - textY }, queueLabel(boss, w), neutrals.white);
  });

  if (overflow > 0) {
    drawLabel(frame, { x, y: labelsBottom, w, h: GLYPH_H }, `+${overflow} more`, neutrals.fog);
  }
}
