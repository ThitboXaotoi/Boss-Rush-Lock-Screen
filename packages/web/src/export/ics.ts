// Calendar export: one event per dated deadline, one all-day event per step.
// Pure: pass `nowMs` in. Line endings, folding and escaping follow RFC 5545.
import type { Plan } from '@boss-rush/core';

/** Max octets per iCalendar content line before folding. */
const FOLD_AT = 75;

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/** Fold one unfolded line to <= FOLD_AT octets per line; continuations start with a space. */
function foldLine(line: string): string[] {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= FOLD_AT) return [line];
  const out: string[] = [];
  let first = true;
  const chars = [...line];
  // Walk whole characters so a multi-byte character never splits across lines.
  const charBytes: number[] = chars.map((c) => new TextEncoder().encode(c).length);
  let current = '';
  let currentLen = 0;
  const limit = () => (first ? FOLD_AT : FOLD_AT - 1);
  for (let i = 0; i < chars.length; i++) {
    const len = charBytes[i]!;
    if (currentLen + len > limit()) {
      out.push((first ? '' : ' ') + current);
      first = false;
      current = '';
      currentLen = 0;
    }
    current += chars[i]!;
    currentLen += len;
  }
  out.push((first ? '' : ' ') + current);
  return out;
}

/** Epoch ms (or ISO date-time with offset) -> UTC `YYYYMMDDTHHMMSSZ`. */
function utcStamp(ms: number): string {
  const d = new Date(ms);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

/** Parse an ISO date-time with an explicit offset. NaN when invalid. */
function parseDeadline(value: string): number {
  // deadlineMs lives in core/time.ts, which core's index does not export yet;
  // Date.parse handles the same ISO-with-offset shape the schema requires.
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
}

/** Keep only UID-safe characters so the ID survives every calendar app. */
function cleanId(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9-_]/g, '-');
  return cleaned.length > 0 ? cleaned : 'x';
}

/**
 * Build the `.ics` file. UIDs embed the boss/step IDs and times, so re-importing
 * the same plan updates the same events instead of duplicating them.
 */
export function buildIcs(plan: Plan, nowMs: number): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Boss Rush//deadlines//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  const stamp = utcStamp(nowMs);
  for (const boss of plan.bosses) {
    if (boss.deadline !== null) {
      const at = parseDeadline(boss.deadline);
      if (Number.isFinite(at)) {
        lines.push(
          'BEGIN:VEVENT',
          `UID:bossrush-boss-${cleanId(boss.id)}-${at}@bossrush`,
          `DTSTAMP:${stamp}`,
          `DTSTART:${utcStamp(at)}`,
          `SUMMARY:${escapeText(boss.title)}`,
          'END:VEVENT',
        );
      }
    }
    for (const step of boss.steps) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:bossrush-step-${cleanId(boss.id)}-${cleanId(step.id)}-${step.due}@bossrush`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${step.due.replace(/-/g, '')}`,
        `SUMMARY:${escapeText(`${boss.short}: ${step.label}`)}`,
        'END:VEVENT',
      );
    }
  }
  lines.push('END:VCALENDAR');
  return lines.flatMap(foldLine).join('\r\n') + '\r\n';
}
