import { compact, fixtureScenes, glass, neutrals } from '@boss-rush/core';
import { expect, it } from 'vitest';
import { drawText, glyphs, textWidth } from '../src';
import { CELL_W, GLYPH_H, GLYPH_W } from '../src/font5x7';
import { namePlateLabel, nextLabel, queueLabel } from '../src/layers/labels';

it('draws one cell per Unicode code point, leaving blank spacing and using ? for missing glyphs', () => {
  const text = '?\u{1F600}?';
  const stride = textWidth(text);
  const buffer = new Uint8Array(stride * GLYPH_H * 4);
  drawText(buffer, stride, 0, 0, text, neutrals.white);

  expect(textWidth('')).toBe(0);
  expect(stride).toBe(3 * CELL_W);
  for (let y = 0; y < GLYPH_H; y++) {
    for (let x = 0; x < stride; x++) {
      const ink = glyphs['?']![y]![x % CELL_W] === '#';
      expect([...buffer.subarray((y * stride + x) * 4, (y * stride + x + 1) * 4)])
        .toEqual(ink ? [...neutrals.white, 255] : [0, 0, 0, 0]);
    }
  }
});

it('clips at each buffer edge without wrapping pixels into neighbouring rows', () => {
  const stride = GLYPH_W - 2;
  const height = GLYPH_H - 2;
  const buffer = new Uint8Array(stride * height * 4);
  drawText(buffer, stride, -1, -1, '??', neutrals.white);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < stride; x++) {
      const ink = glyphs['?']![y + 1]![x + 1] === '#';
      expect(buffer[(y * stride + x) * 4 + 3]).toBe(ink ? 255 : 0);
    }
  }
});

it.each([compact, glass])('formats countdown and NEXT labels within $name zones', ({ zones }) => {
  expect(queueLabel(fixtureScenes.farDay.queue[0]!, zones.queue.w)).toBe('QSB 278');
  expect(namePlateLabel(fixtureScenes.farDay.queue[0]!, zones.namePlate.w)).toBe('QSB 278 31 DAYS');
  expect(queueLabel(fixtureScenes.finalDawn.front, zones.queue.w)).toBe('LOCK 42h');
  expect(namePlateLabel(fixtureScenes.enragedDusk.front, zones.namePlate.w)).toBe('LOCK 5 DAYS');
  expect(namePlateLabel(fixtureScenes.finalDawn.front, zones.namePlate.w)).toBe('LOCK 42 H');
  const tomorrow = { ...fixtureScenes.finalDawn.front, showHours: false };
  expect(namePlateLabel(tomorrow, zones.namePlate.w)).toBe('LOCK 1 DAY');

  const short = 'ABCDE';
  const far = { ...fixtureScenes.farDay.front, short, daysLeft: 3652058 };
  expect(textWidth(queueLabel(far, zones.queue.w))).toBeLessThanOrEqual(zones.queue.w);
  expect(queueLabel(far, zones.queue.w)).toMatch(/3652058d$/);
  expect(textWidth(namePlateLabel(far, zones.namePlate.w))).toBeLessThanOrEqual(zones.namePlate.w);
  const soon = { ...fixtureScenes.finalDawn.front, short };
  const queue = queueLabel(soon, zones.queue.w);
  expect(textWidth(queue)).toBeLessThanOrEqual(zones.queue.w);
  expect(queue).toMatch(/^ABCD[E]? 42h$/);

  const step = fixtureScenes.enragedDusk.nextStep;
  expect(nextLabel({ ...step, due: '2026-01-02' })).toBe('NEXT 1/2 Feature freeze');
  const next = nextLabel({ ...step, due: '2026-12-31', label: '12345678901234' });
  expect(textWidth(next)).toBeLessThanOrEqual(zones.nextLine.w - 2);
  expect(textWidth('+2 more')).toBeLessThanOrEqual(zones.queue.w);
  expect(textWidth('TIME')).toBeLessThan(zones.timer.w);
});
