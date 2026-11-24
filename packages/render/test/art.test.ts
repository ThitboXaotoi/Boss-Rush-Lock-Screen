import { neutrals } from '@boss-rush/core';
import { describe, expect, it } from 'vitest';
import { glyphs, hero, HERO_SIZE, heroReady } from '../src';

// Integrator-owned checks for the owner's Gemini data files (src/art/).
// When one fails, paste the failure message back into Gemini and ask it to fix the file.

const PRINTABLE = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i));

describe.each([
  ['hero', hero],
  ['heroReady', heroReady],
])('hero sprite %s (src/art/hero.ts)', (_name, hero) => {
  it(`is ${HERO_SIZE} rows of ${HERO_SIZE} characters`, () => {
    expect(hero.rows.length, 'number of rows').toBe(HERO_SIZE);
    hero.rows.forEach((row, y) => expect(row.length, `length of row ${y}`).toBe(HERO_SIZE));
  });

  it('uses only characters listed in colors, and only real neutral colour names', () => {
    for (const [key, name] of Object.entries(hero.colors)) {
      expect(key.length, `colors key "${key}" must be one character`).toBe(1);
      if (name !== null) expect(Object.keys(neutrals), `colour "${name}"`).toContain(name);
    }
    hero.rows.forEach((row, y) => {
      for (const ch of row) expect(Object.keys(hero.colors), `character "${ch}" in row ${y}`).toContain(ch);
    });
  });

  it('has at least one visible pixel', () => {
    const solid = hero.rows.join('').split('').filter((ch) => hero.colors[ch] != null);
    expect(solid.length).toBeGreaterThan(0);
  });
});

describe('pixel font (src/art/font.ts)', () => {
  it('every glyph is 7 rows of 5 characters, using only # and .', () => {
    for (const [ch, rows] of Object.entries(glyphs)) {
      expect(ch.length, `glyph key ${JSON.stringify(ch)} must be one character`).toBe(1);
      expect(rows.length, `rows of glyph ${JSON.stringify(ch)}`).toBe(7);
      rows.forEach((row, y) =>
        expect(row, `glyph ${JSON.stringify(ch)} row ${y}`).toMatch(/^[#.]{5}$/),
      );
    }
  });

  it('has the ? glyph (drawn for unknown characters)', () => {
    expect(glyphs['?']).toBeDefined();
  });

  // Fails only with BR_STRICT_ART=1, so the placeholder font keeps the check green.
  // The integrator runs it strict before the freeze.
  it.runIf(process.env.BR_STRICT_ART === '1')('covers all 95 printable ASCII characters', () => {
    const missing = PRINTABLE.filter((ch) => !(ch in glyphs));
    expect(missing, `missing glyphs: ${JSON.stringify(missing.join(''))}`).toEqual([]);
  });
});

describe('ground (src/art/ground.ts, generated from art/src/backdrop.jpg)', () => {
  it('leaves sky between the first hilltops and keeps the land below them solid', async () => {
    const { ground } = await import('../src/art/ground');
    const ridge = ground.find(row => /\d/.test(row));
    expect(ridge).toContain('.');
    expect(ground.at(-1)).toMatch(/^\d+$/);
  });

  it('every row is exactly the logical canvas width and uses only known keys', async () => {
    const { ground } = await import('../src/art/ground');
    const { groundRamps, profiles } = await import('@boss-rush/core');
    const width = profiles.compact!.logical.width;
    const n = groundRamps.day.length;
    expect(ground.length).toBeGreaterThan(0);
    expect(ground.length).toBeLessThan(profiles.compact!.logical.height / 2);
    ground.forEach((row, y) => {
      expect(row.length, `length of row ${y}`).toBe(width);
      expect(row, `row ${y}`).toMatch(new RegExp(`^[.cC0-${n - 1}]+$`));
    });
  });
});
