// Run from the repo: bun packages/render/test/review/proof.ts [boss_bioe] [ISO instant]
// Omit the sprite for a scenery proof. Boss proofs use only the on-disk production atlas and
// show, per profile: the front boss in all four skies, Final, the optional last-day Monster
// and the waiting-column portrait (the front stand-in has no art and draws as an outline).
// Supply an instant to also save an installable wallpaper from the sample plan and completed art.
import { readFileSync, writeFileSync } from 'node:fs';
import { argv, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { compact, derive, fixturePlan, glass, neutrals, profiles, SKY_START_HOUR } from '@boss-rush/core';
import type { Plan } from '@boss-rush/core';
import { decodePng, drawText, encodePng, render, textWidth } from '../../src';
import type { Atlas, Frame } from '../../src';
import { CELL_W, GLYPH_H } from '../../src/font5x7';
import { drawSprite } from '../../src/layers/atlas';
import { fillBox } from '../../src/layers/pixels';

const sprite = argv[2];
const assets = new URL('../../../../art/export/', import.meta.url);
const { sprites }: Pick<Atlas, 'sprites'> = JSON.parse(readFileSync(new URL('atlas.json', assets), 'utf8'));
const atlas: Atlas = { sprites, ...decodePng(readFileSync(new URL('atlas.png', assets))) };
const hasArt = (prefix: string) => ['light', 'dark', 'final', 'portrait'].every(v => sprites[`${prefix}_${v}`]);
if (sprite && (!/^[a-z0-9_]+$/.test(sprite) || !hasArt(sprite))) {
  throw new Error(`Import Light, Dark, Final and a portrait for ${sprite} before making its proof.`);
}
const base = fixturePlan.bosses.find(b => b.sprite === sprite) ?? fixturePlan.bosses[0]!;
const availableSprites = new Set(sprite ? [sprite] : []);
const plan: Plan = {
  ...fixturePlan, timezone: 'UTC',
  settings: { ...fixturePlan.settings, timeOfDay: true, widgetFrame: false, phaseDays: { awake: 14, enraged: 7, final: 3, now: 1 } },
  bosses: [{
    ...base, sprite: sprite ?? base.sprite,
    short: sprite && sprite !== base.sprite ? sprite.replace(/^boss_/, '').slice(0, 5).toUpperCase() : base.short,
    deadline: '2026-11-23T23:59:00Z', steps: [],
  }],
};

const skies = ['dawn', 'day', 'dusk', 'night'] as const;
const gap = CELL_W * 2, line = GLYPH_H + CELL_W;
const left = textWidth('PORTRAIT') + 2 * gap;
const tileWidth = Math.max(compact.logical.width, glass.logical.width);
const forms = sprite
  ? ['front', 'final', ...(sprites[`${sprite}_monster`] ? ['monster'] : []), 'in queue']
  : ['scenery'];
const rows = [compact, glass].flatMap(profile =>
  forms.map(form => ({ profile, form })),
);
const top = gap + 2 * line;
const width = left + skies.length * (tileWidth + gap);
const height = top + rows.reduce((h, { profile }) => h + profile.logical.height + gap, 0);
const sheet: Frame = { width, height, rgba: new Uint8Array(width * height * 4) };
fillBox(sheet, { x: 0, y: 0, w: width, h: height }, neutrals.ink);
const label = (x: number, y: number, text: string) => drawText(sheet.rgba, width, x, y, text, neutrals.white);
label(gap, gap, sprite ? `BOSS PROOF / ${sprite}` : 'SCENERY PROOF / NO BOSS ART');
skies.forEach((sky, i) => label(left + i * (tileWidth + gap), gap + line, sky));

let y = top;
for (const { profile, form } of rows) {
  label(gap, y, profile.name);
  label(gap, y + line, form);
  if (sprite) {
    const side = profile.queue.portrait;
    label(gap, y + 3 * line, 'PORTRAIT');
    label(gap, y + 4 * line, `${side}x${side}`);
    drawSprite(sheet, atlas, `${sprite}_portrait`, { x: gap, y: y + 5 * line, w: side, h: side });
  }
  skies.forEach((sky, i) => {
    const day = form === 'monster' ? 23 : form === 'final' ? 21 : 3;
    const at = Date.UTC(2026, 10, day, SKY_START_HOUR[sky]);
    let scene = derive(plan, at, { availableSprites });
    if (form === 'in queue' && scene.front) {
      // Show the reviewed boss in the waiting column behind a stand-in (outlined box).
      const boss = scene.front;
      scene = {
        ...scene,
        front: { ...boss, id: 'stand-in', sprite: 'boss_none', short: 'NONE' },
        queue: [boss],
        queueOverflow: 0,
      };
    }
    const screen = render(scene, profile, atlas, { device: profile.logical });
    const x = left + i * (tileWidth + gap);
    for (let j = 0; j < screen.height; j++) {
      const stride = screen.width * 4;
      sheet.rgba.set(screen.rgba.subarray(j * stride, (j + 1) * stride), ((y + j) * width + x) * 4);
    }
  });
  y += profile.logical.height + gap;
}

const file = new URL(`${sprite ?? 'scenery'}-four-skies.png`, import.meta.url);
writeFileSync(file, encodePng(sheet));
stdout.write(`${fileURLToPath(file)}\n`);

const instant = argv[3];
if (instant) {
  const now = Date.parse(instant);
  if (!Number.isFinite(now) || !/(Z|[+-]\d\d:\d\d)$/.test(instant)) throw new Error('Use an ISO instant with offset.');
  const finished = new Set(fixturePlan.bosses.map(b => b.sprite).filter(hasArt));
  const scene = derive(fixturePlan, now, { availableSprites: finished });
  if (scene.front?.sprite !== sprite) throw new Error(`${sprite} is not in front in the sample plan at that instant.`);
  const profile = Object.values(profiles).find(p => p.name === fixturePlan.settings.profile);
  if (!profile) throw new Error(`Unknown sample profile: ${fixturePlan.settings.profile}`);
  const frame = render(scene, profile, atlas, { device: fixturePlan.settings.device });
  const deviceFile = new URL(`${sprite}-device.png`, import.meta.url);
  writeFileSync(deviceFile, encodePng(frame));
  stdout.write(`${fileURLToPath(deviceFile)} (${frame.width} x ${frame.height}; queue: ${scene.queue.map(b => b.short).join(', ')})\n`);
}
