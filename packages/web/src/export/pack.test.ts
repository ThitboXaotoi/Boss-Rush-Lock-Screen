import type { PackEntry } from '@boss-rush/core';
import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import { buildPackZip, entryForNow, limitToDates, packZipName } from './pack';

const entries: PackEntry[] = [
  { fileName: 'BR_2026-11-22_midnight.png', date: '2026-11-22', slot: 'midnight', at: 1000 },
  { fileName: 'BR_2026-11-22_dawn.png', date: '2026-11-22', slot: 'dawn', at: 2000 },
  { fileName: 'BR_2026-11-23_midnight.png', date: '2026-11-23', slot: 'midnight', at: 3000 },
];

async function zipNames(bytes: Uint8Array): Promise<string[]> {
  const zip = await JSZip.loadAsync(bytes);
  return Object.keys(zip.files).sort();
}

describe('buildPackZip', () => {
  it('puts exactly the three rendered names at the top level', async () => {
    const seen: string[] = [];
    const bytes = await buildPackZip(entries, (entry) => {
      seen.push(entry.fileName);
      return new TextEncoder().encode(`png-bytes-for-${entry.fileName}`);
    });
    expect(seen).toEqual(entries.map((e) => e.fileName));
    expect(await zipNames(bytes)).toEqual([
      'BR_2026-11-22_dawn.png',
      'BR_2026-11-22_midnight.png',
      'BR_2026-11-23_midnight.png',
    ]);
    // No folders: every name is a bare file name.
    for (const name of await zipNames(bytes)) {
      expect(name).not.toContain('/');
    }
  });

  it('reports progress per picture and yields between pictures', async () => {
    const progress: [number, number][] = [];
    let yields = 0;
    const tick = () => {
      yields += 1;
    };
    await buildPackZip(
      entries,
      (entry) => {
        setTimeout(tick, 0);
        return new TextEncoder().encode(entry.fileName);
      },
      { onProgress: (p) => progress.push([p.done, p.total]) },
    );
    expect(progress).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    // The builder awaited a macrotask per picture, so our queued ticks all ran.
    expect(yields).toBe(3);
  });

  it('stops when aborted', async () => {
    const controller = new AbortController();
    const render = vi.fn((entry: PackEntry) => new TextEncoder().encode(entry.fileName));
    await expect(
      buildPackZip(entries, render, {
        signal: controller.signal,
        onProgress: () => controller.abort(),
      }),
    ).rejects.toThrow();
    expect(render).toHaveBeenCalledTimes(1);
  });
});

describe('packZipName', () => {
  it('names the zip from the first and last dates', () => {
    expect(packZipName(entries)).toBe('BossRush_pack_2026-11-22_2026-11-23.zip');
  });
});

describe('limitToDates', () => {
  it('keeps only entries on the wanted dates', () => {
    expect(limitToDates(entries, ['2026-11-22']).map((e) => e.fileName)).toEqual([
      'BR_2026-11-22_midnight.png',
      'BR_2026-11-22_dawn.png',
    ]);
  });
});

describe('entryForNow', () => {
  it('picks the latest slot at or before now', () => {
    expect(entryForNow(entries, 2500)?.fileName).toBe('BR_2026-11-22_dawn.png');
    expect(entryForNow(entries, 2000)?.fileName).toBe('BR_2026-11-22_dawn.png');
  });

  it('falls back to the first entry before the pack starts', () => {
    expect(entryForNow(entries, 500)?.fileName).toBe('BR_2026-11-22_midnight.png');
  });

  it('returns undefined for an empty pack', () => {
    expect(entryForNow([], 2500)).toBeUndefined();
  });
});
