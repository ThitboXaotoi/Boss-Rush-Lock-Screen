// The picture pack: which pictures exist and what they are called. Pure.
// SHARED CONTRACT with the Shortcuts recipes (packages/phone) and the exporter (web/src/export):
// the phone finds a picture by this exact file name. Type shapes are integrator-only;
// brief A implements the function bodies.
import type { Sky } from './derive';
import type { Plan } from './schema';
import { addDays, clockFor, daysBetween, deadlineMs } from './time';

/** One picture per slot per day. `midnight` exists because the day count changes at 00:00. */
export type PackSlot = 'midnight' | 'dawn' | 'day' | 'dusk' | 'night';

export const PACK_SLOTS: readonly { slot: PackSlot; hour: number; sky: Sky }[] = [
  { slot: 'midnight', hour: 0, sky: 'night' },
  { slot: 'dawn', hour: 5, sky: 'dawn' },
  { slot: 'day', hour: 9, sky: 'day' },
  { slot: 'dusk', hour: 17, sky: 'dusk' },
  { slot: 'night', hour: 20, sky: 'night' },
];

export interface PackEntry {
  /** `BR_YYYY-MM-DD_<slot>.png` */
  fileName: string;
  /** YYYY-MM-DD in the plan's timezone. */
  date: string;
  slot: PackSlot;
  /** Epoch ms of the slot's start in the plan's timezone; pass to derive() as `now`. */
  at: number;
}

/** File name the Shortcuts automation for `slot` looks up on `date` (YYYY-MM-DD). */
export function packFileName(date: string, slot: PackSlot): string {
  return `BR_${date}_${slot}.png`;
}

/**
 * Every entry from the day containing `from` to the day of the last deadline,
 * in time order. With `settings.timeOfDay` false, only the `midnight` slot per day.
 */
export function packEntries(_plan: Plan, _from: number): PackEntry[] {
  let latest = -Infinity;
  for (const { deadline } of _plan.bosses) {
    const at = deadlineMs(deadline);
    if (at > latest) latest = at;
  }
  if (!Number.isFinite(latest)) return [];

  const clock = clockFor(_plan.timezone);
  const firstDate = clock.local(_from).date;
  const lastDay = daysBetween(firstDate, clock.local(latest).date);
  const slots = _plan.settings.timeOfDay ? PACK_SLOTS : PACK_SLOTS.filter(s => s.slot === 'midnight');
  const entries: PackEntry[] = [];
  for (let day = 0; day <= lastDay; day++) {
    const date = addDays(firstDate, day);
    for (const { slot, hour } of slots) {
      entries.push({ date, slot, at: clock.atHour(date, hour), fileName: packFileName(date, slot) });
    }
  }
  return entries.sort((a, b) => a.at - b.at);
}
