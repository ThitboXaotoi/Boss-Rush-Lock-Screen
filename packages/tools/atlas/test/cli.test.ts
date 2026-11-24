import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodePng, encodePng } from '@boss-rush/render';
import { runImport } from '../src/import-run';
import { nativeSides } from '../src/import-settings';
import type { AtlasFile } from '../src/packer';
import { MAGENTA, fill, image } from './fixtures';

const roots: string[] = [];

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'boss-rush-e-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function writeSource(root: string, sprite: string, variant: string, colour: readonly [number, number, number]): Promise<void> {
  await mkdir(join(root, 'art/src', sprite), { recursive: true });
  const source = image(8, 8, MAGENTA);
  fill(source, 2, 2, 4, 4, colour);
  await writeFile(join(root, 'art/src', sprite, `${variant}.png`), encodePng(source));
}

async function writeSettings(root: string, value: unknown): Promise<void> {
  await mkdir(join(root, 'art/export'), { recursive: true });
  await writeFile(join(root, 'art/export/import.json'), JSON.stringify(value));
}

describe('runImport', () => {
  it('writes four sprites, the atlas and the generated palette', async () => {
    const root = await makeRoot();
    await writeSource(root, 'boss_x', 'light', [255, 0, 0]);
    await writeSource(root, 'boss_x', 'dark', [0, 0, 255]);
    await writeSource(root, 'boss_x', 'final', [0, 255, 0]);
    await writeSettings(root, {
      version: 1,
      size: { boss: 4, portrait: 4 },
      sprites: { boss_x: {} },
    });

    const palettePath = join(root, 'palette.bosses.ts');
    const result = await runImport({ root, palettePath, log: () => undefined });

    expect(result.errors).toEqual([]);
    expect(result.written.sort()).toEqual([
      'boss_x_dark.png',
      'boss_x_final.png',
      'boss_x_light.png',
      'boss_x_portrait.png',
    ]);

    const atlasJson = JSON.parse(await readFile(join(root, 'art/export/atlas.json'), 'utf8')) as AtlasFile;
    expect(Object.keys(atlasJson.sprites)).toEqual([
      'boss_x_dark',
      'boss_x_final',
      'boss_x_light',
      'boss_x_portrait',
    ]);
    for (const rect of Object.values(atlasJson.sprites)) expect([rect.w, rect.h]).toEqual([4, 4]);

    const atlasPng = decodePng(new Uint8Array(await readFile(join(root, 'art/export/atlas.png'))));
    expect(atlasPng.width).toBe(atlasJson.width);
    expect(atlasPng.height).toBe(atlasJson.height);

    const palette = await readFile(palettePath, 'utf8');
    expect(palette).toContain('"boss_x"');
    expect(palette).toContain('0xff, 0x00, 0x00');
    expect(palette).toContain('0x00, 0x00, 0xff');
    expect(palette).toContain('0x00, 0xff, 0x00');

    const settings = JSON.parse(await readFile(join(root, 'art/export/import.json'), 'utf8')) as {
      version: number;
      size: { boss: number };
      sprites: Record<string, unknown>;
    };
    expect(settings.version).toBe(1);
    expect(settings.size.boss).toBe(4);
    expect(settings.sprites.boss_x).toEqual({});
    expect(result.warnings.some((warning) => /backdrop\.png is missing/.test(warning))).toBe(true);
  });

  it('writes a native copy for every other profile side unless a size is pinned', async () => {
    const root = await makeRoot();
    await writeSource(root, 'boss_x', 'light', [255, 0, 0]);
    await writeSource(root, 'boss_x', 'dark', [0, 0, 255]);
    await writeSource(root, 'boss_x', 'final', [0, 255, 0]);
    await writeSettings(root, { version: 1, sprites: { boss_x: {} } });

    const sides = nativeSides();
    expect(sides.boss.length, 'the profiles must differ in boss size for this test').toBeGreaterThan(1);
    const result = await runImport({ root, palettePath: join(root, 'palette.bosses.ts'), log: () => undefined });
    expect(result.errors).toEqual([]);
    expect(result.written).toContain('boss_x_light.png');
    expect(result.written).toContain(`boss_x_light_${sides.boss[1]}.png`);
    expect(result.written).toContain(`boss_x_portrait_${sides.portrait[1]}.png`);
    const atlas = JSON.parse(await readFile(join(root, 'art/export/atlas.json'), 'utf8')) as AtlasFile;
    expect(Object.keys(atlas.sprites)).toContain(`boss_x_light_${sides.boss[1]}`);
    // The per-boss palette collects colours from the native copies too.
    const palette = await readFile(join(root, 'palette.bosses.ts'), 'utf8');
    expect(palette).toContain('"boss_x"');
    expect(palette).toContain('0xff, 0x00, 0x00');
  });

  it('packs an optional monster at both boss sizes, with the Final crop and its own palette override', async () => {
    const root = await makeRoot();
    const options = { root, palettePath: join(root, 'palette.bosses.ts'), log: () => undefined };
    for (const v of ['light', 'dark', 'final', 'monster']) await writeSource(root, 'boss_x', v, [200, 90, 100]);
    await writeSettings(root, {
      version: 1,
      sprites: {
        boss_x: {
          final: { crop: { x: 2, y: 2, w: 4, h: 4 }, background: '#ff00ff', mode: 'snap', palette: ['#663344'] },
          monster: { palette: ['#dd8899'] },
        },
      },
    });

    const result = await runImport(options);
    expect(result.errors).toEqual([]);
    const json = JSON.parse(await readFile(join(root, 'art/export/atlas.json'), 'utf8')) as AtlasFile;
    const atlas = decodePng(await readFile(join(root, 'art/export/atlas.png')));
    for (const [i, side] of nativeSides().boss.entries()) {
      const key = `boss_x_monster${i === 0 ? '' : `_${side}`}`;
      const rect = json.sprites[key]!;
      expect([rect.w, rect.h]).toEqual([side, side]);
      // Without the inherited crop, this corner would be transparent; without snap, the source colour.
      const p = (rect.y * atlas.width + rect.x) * 4;
      expect([...atlas.rgba.subarray(p, p + 4)]).toEqual([0xdd, 0x88, 0x99, 255]);
    }
    expect(result.palette.boss_x).toContainEqual([0xdd, 0x88, 0x99]);

    // Moving an unapproved optional source back to drafts must withdraw both atlas keys.
    await rm(join(root, 'art/src/boss_x/monster.png'));
    const withdrawn = await runImport(options);
    expect(withdrawn.errors).toEqual([]);
    expect(withdrawn.atlas.keys.some(key => key.includes('_monster'))).toBe(false);
    expect(withdrawn.atlas.keys).toContain('boss_x_final');
  });

  it('keeps a locked sprite file untouched and packs it', async () => {
    const root = await makeRoot();
    await writeSource(root, 'boss_x', 'light', [255, 0, 0]);
    await writeSource(root, 'boss_x', 'dark', [0, 0, 255]);
    await writeSource(root, 'boss_x', 'final', [0, 255, 0]);
    await writeSettings(root, {
      version: 1,
      size: { boss: 4, portrait: 4 },
      sprites: { boss_x: { locked: ['light'] } },
    });

    const edited = image(4, 4, [255, 255, 0]);
    await mkdir(join(root, 'art/export/sprites'), { recursive: true });
    const editedBytes = encodePng(edited);
    await writeFile(join(root, 'art/export/sprites/boss_x_light.png'), editedBytes);

    const result = await runImport({ root, palettePath: join(root, 'palette.bosses.ts'), log: () => undefined });
    expect(result.errors).toEqual([]);

    const kept = await readFile(join(root, 'art/export/sprites/boss_x_light.png'));
    expect(Buffer.from(kept).toString('hex')).toBe(Buffer.from(editedBytes).toString('hex'));

    const atlas = decodePng(new Uint8Array(await readFile(join(root, 'art/export/atlas.png'))));
    const json = JSON.parse(await readFile(join(root, 'art/export/atlas.json'), 'utf8')) as AtlasFile;
    const rect = json.sprites.boss_x_light!;
    const i = (rect.y * atlas.width + rect.x) * 4;
    expect([...atlas.rgba.slice(i, i + 4)]).toEqual([255, 255, 0, 255]);
    expect(await readFile(join(root, 'palette.bosses.ts'), 'utf8')).toContain('0xff, 0xff, 0x00');
  });

  it('creates import.json from the art/src folders on a first run', async () => {
    const root = await makeRoot();
    await writeSource(root, 'boss_x', 'light', [255, 0, 0]);
    await writeSource(root, 'boss_x', 'dark', [0, 0, 255]);
    await writeSource(root, 'boss_x', 'final', [0, 255, 0]);

    const result = await runImport({ root, palettePath: join(root, 'palette.bosses.ts'), log: () => undefined });
    expect(result.errors).toEqual([]);

    const settings = JSON.parse(await readFile(join(root, 'art/export/import.json'), 'utf8')) as {
      version: number;
      sprites: Record<string, unknown>;
    };
    expect(settings.version).toBe(1);
    expect(settings.sprites).toEqual({ boss_x: {} });
  });
});
