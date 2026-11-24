// Entry for `art:lint` (the integrator adds the script to packages/tools/package.json).
// Run it after art:import, in its own process, so core loads the regenerated palette.
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allColors } from '@boss-rush/core';
import { decodePng } from '@boss-rush/render';
import { lintSprites } from './lint';
import type { LintEntry } from './lint';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const dir = join(root, 'art/export/sprites');

let files: string[] = [];
try {
  files = (await readdir(dir)).filter((file) => file.endsWith('.png')).sort();
} catch {
  files = [];
}

const entries: LintEntry[] = [];
for (const file of files) {
  try {
    entries.push({ key: file.slice(0, -'.png'.length), image: decodePng(new Uint8Array(await readFile(join(dir, file)))) });
  } catch (error) {
    console.error(`art:lint: ${file} could not be read: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

const report = lintSprites(entries, allColors());
for (const issue of report.issues) console.error(`  ${issue}`);
console.log(`art:lint: ${entries.length} sprite file(s), ${report.complete.length} complete boss(es)`);
for (const sprite of report.complete) console.log(`  complete: ${sprite}`);
for (const { sprite, missing } of report.incomplete) {
  console.log(`  incomplete: ${sprite} (missing ${missing.join(', ')})`);
}
if (report.issues.length > 0) process.exitCode = 1;
