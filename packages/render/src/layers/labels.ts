import { neutrals } from '@boss-rush/core';
import type { BossState, NextStep, Rect, Rgb } from '@boss-rush/core';
import { CELL_W, drawText, GLYPH_H, textWidth } from '../font5x7';
import type { Frame } from '../render';
import { fillBox } from './pixels';

function clipText(text: string, width: number): string {
  return [...text].slice(0, Math.max(0, Math.floor(width / CELL_W))).join('');
}

const SECRET = '???';

/** The exact short name is the marker, regardless of sprite or boss ID. */
export function hasSecretDate(boss: Pick<BossState, 'short'>): boolean {
  return boss.short === SECRET;
}

// Owner, Nov 23: show the course ("QSB 278") wherever it fits; the short name is the fallback.
// A secret boss keeps its `???` short name, so its title can never leak.
function displayName(boss: BossState, width: number): string {
  return !hasSecretDate(boss) && textWidth(boss.title) <= width ? boss.title : boss.short;
}

// Keep the countdown and its unit, even when the profile can't show the whole name.
function countdown(boss: BossState, remaining: string, width: number): string {
  const time = hasSecretDate(boss) ? SECRET : remaining;
  const room = width - textWidth(` ${time}`);
  const name = clipText(displayName(boss, room), room);
  return name ? `${name} ${time}` : clipText(time, width);
}

// A waiting boss shows its course when the title fits the column: "MATH 15D" read as a course
// number (owner's phone test, Nov 23). The front plate keeps the countdown.
export function queueLabel(boss: BossState, width: number): string {
  if (displayName(boss, width) === boss.title) return boss.title;
  const time = boss.showHours ? `${boss.hoursLeft}h` : `${boss.daysLeft}d`;
  return countdown(boss, time, width);
}

export function namePlateLabel(boss: BossState, width: number): string {
  const time = boss.showHours
    ? `${boss.hoursLeft} H`
    : `${boss.daysLeft} ${boss.daysLeft === 1 ? 'DAY' : 'DAYS'}`;
  return countdown(boss, time, width);
}

export function nextLabel(step: NextStep): string {
  const [, month, day] = step.due.split('-');
  return `NEXT ${Number(month)}/${Number(day)} ${step.label}`;
}

export function drawLabel(
  frame: Frame,
  box: Rect,
  label: string,
  colour: Rgb,
  centered = false,
): void {
  if (box.h < GLYPH_H) return;
  const text = clipText(label, box.w);
  const x = box.x + (centered ? Math.floor((box.w - textWidth(text)) / 2) : 0);
  const y = box.y + Math.floor((box.h - GLYPH_H) / 2);
  drawText(frame.rgba, frame.width, x, y, text, colour);
}

export function drawNamePlate(frame: Frame, box: Rect, boss: BossState): void {
  const colour = boss.phase === 'final' || boss.phase === 'now' ? neutrals.warning : neutrals.white;
  fillBox(frame, box, neutrals.ink);
  drawLabel(frame, box, namePlateLabel(boss, box.w), colour, true);
}

export function drawTimer(frame: Frame, box: Rect, timer: number, phase: BossState['phase']): void {
  fillBox(frame, box, neutrals.ink);
  const label = 'TIME';
  const labelBox = { x: box.x + 1, y: box.y + 1, w: textWidth(label), h: box.h - 2 };
  if (labelBox.w > box.w - 2) return;
  drawLabel(frame, labelBox, label, neutrals.white);

  const x = labelBox.x + labelBox.w + 1;
  const track = { ...labelBox, x, w: box.x + box.w - 1 - x };
  if (track.w <= 0) return;
  const fill = phase === 'dormant' || phase === 'awake' ? neutrals.gold : neutrals.warning;
  fillBox(frame, track, neutrals.slate);
  fillBox(frame, { ...track, w: Math.round(track.w * Math.min(1, Math.max(0, timer))) }, fill);
}

export function drawNext(frame: Frame, box: Rect, step: NextStep): void {
  fillBox(frame, box, neutrals.ink);
  drawLabel(frame, { ...box, x: box.x + 1, w: box.w - 2 }, nextLabel(step), neutrals.white);
}
