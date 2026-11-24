import type { Plan } from '@boss-rush/core';
import { PLAN_VERSION } from '@boss-rush/core';

export function exportPlanJson(plan: Plan): string {
  return JSON.stringify(plan, null, 2);
}

export type ParsePlanResult =
  | { ok: true; plan: Plan }
  | { ok: false; error: string };

export function parsePlanJson(text: string): ParsePlanResult {
  if (!text || !text.trim()) {
    return { ok: false, error: 'File is empty.' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Plan must be a JSON object.' };
  }

  const p = parsed as Partial<Plan>;
  if (p.version !== PLAN_VERSION) {
    return { ok: false, error: `Invalid plan version: expected ${PLAN_VERSION}.` };
  }
  if (!Array.isArray(p.bosses)) {
    return { ok: false, error: 'Plan must contain a bosses array.' };
  }
  if (!p.settings || typeof p.settings !== 'object') {
    return { ok: false, error: 'Plan must contain settings.' };
  }

  return { ok: true, plan: parsed as Plan };
}

export function formatRemindersList(plan: Plan): string {
  const lines: string[] = [];
  lines.push('Boss Rush — Reminders Schedule');
  lines.push('==============================');
  lines.push(`Time Zone: ${plan.timezone}`);
  lines.push('');

  for (const b of plan.bosses) {
    const deadlineStr = b.deadline ? b.deadline.replace('T', ' ') : 'No deadline';
    lines.push(`[${b.short}] ${b.title} (Deadline: ${deadlineStr})`);
    if (b.steps.length === 0) {
      lines.push('  (No prep steps)');
    } else {
      for (const s of b.steps) {
        lines.push(`  [ ] ${s.due} ${s.label}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export function downloadJsonFile(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
