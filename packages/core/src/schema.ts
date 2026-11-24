// Plan types for `deadlines.json`. Source: PLAN.md -> "Data model".
// SHARED CONTRACT: the type shapes here are integrator-only (see briefs/README.md).
// Brief A implements the function bodies.
import { PROFILE_NAMES } from './profiles';
import { clockFor, deadlineMs, isLocalDate } from './time';

export const PLAN_VERSION = 1;

export type Motion = 'off' | 'wake' | 'tap' | 'tilt';

/** Days-left thresholds at which a boss enters each phase. */
export interface PhaseDays {
  awake: number;
  enraged: number;
  final: number;
  now: number;
}

export interface PlanSettings {
  phaseDays: PhaseDays;
  motion: Motion;
  /** False: every picture uses the dusk sky and the Light boss. */
  timeOfDay: boolean;
  /** One of the profile names in profiles.ts. */
  profile: string;
  device: { width: number; height: number };
  /** Draw the optional pixel-art frame around the widget zone. Off by default. */
  widgetFrame: boolean;
}

/** A dated prep step. Steps are a schedule only: there is no done state (design/layout.md). */
export interface Step {
  id: string;
  /** 14 characters or fewer. */
  label: string;
  /** ISO date, YYYY-MM-DD, on or before the boss deadline. */
  due: string;
}

export interface Boss {
  id: string;
  title: string;
  /** 5 characters or fewer. */
  short: string;
  subject: string;
  /** ISO date-time with offset, or null when not yet known (hidden from render). */
  deadline: string | null;
  /** Atlas key prefix: `<sprite>_light`, `_dark`, `_final`, `_portrait`. */
  sprite: string;
  /** 0 to 6 steps. */
  steps: Step[];
}

export interface Plan {
  version: typeof PLAN_VERSION;
  /** IANA time zone, e.g. America/Los_Angeles. */
  timezone: string;
  settings: PlanSettings;
  bosses: Boss[];
}

export interface ValidationIssue {
  /** JSON-pointer-like path, e.g. `bosses[1].steps[0].due`. */
  path: string;
  message: string;
}

/** Every rule in PLAN.md -> "Validation". Returns [] for a valid plan; never throws. */
export function validatePlan(_plan: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const report = (path: string, message: string) => { issues.push({ path, message }); };
  const record = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v);
  const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
  const fits = (v: unknown, max: number) => text(v) && [...v].length <= max;
  const positiveWhole = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1;

  function checkPhases(value: unknown) {
    const path = 'settings.phaseDays';
    if (!record(value)) {
      report(path, 'Enter the number of days for each boss phase.');
      return;
    }
    for (const name of ['awake', 'enraged', 'final', 'now'] as const) {
      if (!positiveWhole(value[name])) report(`${path}.${name}`, `Enter at least one whole day for the ${name} phase.`);
    }
    const { awake, enraged, final, now } = value;
    if (positiveWhole(awake) && positiveWhole(enraged) && awake <= enraged) {
      report(`${path}.awake`, 'Set Awake to more days than Enraged.');
    }
    if (positiveWhole(enraged) && positiveWhole(final) && enraged <= final) {
      report(`${path}.enraged`, 'Set Enraged to more days than Final.');
    }
    if (positiveWhole(final) && positiveWhole(now) && final < now) {
      report(`${path}.final`, 'Set Final to at least as many days as Now.');
    }
  }

  function checkSettings(value: unknown) {
    if (!record(value)) {
      report('settings', 'Include the settings from a plan saved by the planner.');
      return;
    }
    checkPhases(value.phaseDays);
    const motions: Motion[] = ['off', 'wake', 'tap', 'tilt'];
    if (!motions.some(m => m === value.motion)) report('settings.motion', 'Choose off, wake, tap, or tilt for motion.');
    if (!PROFILE_NAMES.some(p => p === value.profile)) {
      report('settings.profile', `Choose one of these layouts: ${PROFILE_NAMES.join(', ')}.`);
    }
    if (!record(value.device)) {
      report('settings.device', 'Enter your screen width and height in pixels.');
    } else {
      for (const side of ['width', 'height'] as const) {
        if (!positiveWhole(value.device[side])) {
          report(`settings.device.${side}`, `Enter a whole number greater than zero for the screen ${side} in pixels.`);
        }
      }
    }
    if (typeof value.timeOfDay !== 'boolean') report('settings.timeOfDay', 'Turn time of day on or off.');
    if (typeof value.widgetFrame !== 'boolean') report('settings.widgetFrame', 'Turn the widget frame on or off.');
  }

  function checkId(value: unknown, path: string, seen: Set<string>, kind: 'boss' | 'step') {
    if (!text(value)) report(path, `Give this ${kind} an ID.`);
    else if (seen.has(value)) {
      report(path, kind === 'boss' ? 'Give each boss a different ID.' : 'Give each step in this boss a different ID.');
    } else seen.add(value);
  }

  function checkSteps(value: unknown, path: string, lastDate?: string) {
    if (!Array.isArray(value) || value.length > 6) {
      report(path, 'Use a list of up to six steps. It can be empty.');
      return;
    }
    const ids = new Set<string>();
    for (const [i, step] of value.entries()) {
      const item = `${path}[${i}]`;
      if (!record(step)) {
        report(item, 'Enter an ID, label, and due date for this step.');
        continue;
      }
      checkId(step.id, `${item}.id`, ids, 'step');
      if (!fits(step.label, 14)) report(`${item}.label`, 'Give this step a label of 1 to 14 characters.');
      if (!isLocalDate(step.due)) report(`${item}.due`, 'Enter a real date as year-month-day, for example 2026-11-23.');
      else if (lastDate && step.due > lastDate) {
        report(`${item}.due`, `Move this step to ${lastDate} or earlier, or move the boss deadline.`);
      }
    }
  }

  try {
    if (!record(_plan)) return [{ path: 'plan', message: 'Choose a Boss Rush plan saved by the planner.' }];
    if (_plan.version !== PLAN_VERSION) report('version', `Use a version ${PLAN_VERSION} plan from the planner.`);

    let clock: ReturnType<typeof clockFor> | undefined;
    try {
      if (typeof _plan.timezone === 'string') clock = clockFor(_plan.timezone);
    } catch {
      // Keep checking the plan; only comparisons to a deadline's local date need a valid zone.
    }
    if (!clock) report('timezone', 'Choose a named time zone, for example America/Los_Angeles.');
    checkSettings(_plan.settings);

    const bosses = _plan.bosses;
    if (!Array.isArray(bosses) || bosses.length < 1 || bosses.length > 6) {
      report('bosses', 'Include between one and six bosses.');
      return issues;
    }
    const ids = new Set<string>();
    for (const [i, boss] of bosses.entries()) {
      const path = `bosses[${i}]`;
      if (!record(boss)) {
        report(path, 'Enter the details for this boss or remove it.');
        continue;
      }
      checkId(boss.id, `${path}.id`, ids, 'boss');
      if (!text(boss.title)) report(`${path}.title`, 'Give this boss a title.');
      if (!fits(boss.short, 5)) report(`${path}.short`, 'Give this boss a short name of 1 to 5 characters.');
      if (typeof boss.subject !== 'string') report(`${path}.subject`, 'Enter a subject or leave the subject text empty.');
      if (typeof boss.sprite !== 'string' || !/^[a-z0-9_]+$/.test(boss.sprite)) {
        report(`${path}.sprite`, 'Use only lowercase letters, numbers, and underscores for the sprite name.');
      }
      let lastDate: string | undefined;
      if (boss.deadline !== null) {
        const at = deadlineMs(boss.deadline);
        if (Number.isFinite(at)) lastDate = clock?.local(at).date;
        else report(`${path}.deadline`, 'Enter a date and time with its offset, such as 2026-11-23T23:59-08:00, or leave it unset.');
      }
      checkSteps(boss.steps, `${path}.steps`, lastDate);
    }
  } catch {
    // The input is unknown, including objects whose properties throw when read.
    report('plan', 'This plan could not be read. Choose a plan saved by the planner.');
  }
  return issues;
}
