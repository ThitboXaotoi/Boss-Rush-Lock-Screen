// Picture-pack zip builder. Pure orchestration around an injected renderer, so the
// contract (names at the top level, no folder) is testable with a fake renderer.
import type { PackEntry } from '@boss-rush/core';
import JSZip from 'jszip';

export interface PackProgress {
  done: number;
  total: number;
}

export interface BuildPackOptions {
  /** Cancel between pictures. When aborted, the promise rejects with an AbortError. */
  signal?: AbortSignal;
  onProgress?: (progress: PackProgress) => void;
}

/**
 * Zip every entry's PNG at the top level of the archive (no folder), one picture
 * per turn of the event loop so the page stays responsive. Each file's zip date is
 * its slot time, so the same plan builds the same bytes.
 */
export async function buildPackZip(
  entries: readonly PackEntry[],
  renderPng: (entry: PackEntry) => Promise<Uint8Array> | Uint8Array,
  options?: BuildPackOptions,
): Promise<Uint8Array> {
  const zip = new JSZip();
  let done = 0;
  for (const entry of entries) {
    options?.signal?.throwIfAborted();
    const png = await renderPng(entry);
    zip.file(entry.fileName, png, { date: new Date(entry.at) });
    done += 1;
    options?.onProgress?.({ done, total: entries.length });
    // Yield so progress paints and cancel stays responsive during a ~150-picture pack.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  options?.signal?.throwIfAborted();
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/** `BossRush_pack_<first date>_<last date>.zip`, from the entries' own dates. */
export function packZipName(entries: readonly PackEntry[]): string {
  const first = entries[0]?.date ?? 'nodates';
  const last = entries[entries.length - 1]?.date ?? first;
  return `BossRush_pack_${first}_${last}.zip`;
}

/** Keep only the entries on the given YYYY-MM-DD dates (the test pack). */
export function limitToDates(
  entries: readonly PackEntry[],
  dates: readonly string[],
): PackEntry[] {
  const wanted = new Set(dates);
  return entries.filter((entry) => wanted.has(entry.date));
}

/** The entry covering `now`: the latest slot at or before it, else the first entry. */
export function entryForNow(
  entries: readonly PackEntry[],
  now: number,
): PackEntry | undefined {
  let current = entries[0];
  for (const entry of entries) {
    if (entry.at > now) break;
    current = entry;
  }
  return current;
}
