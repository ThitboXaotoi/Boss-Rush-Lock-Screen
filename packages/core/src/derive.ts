// plan + now -> SceneState. Pure: no clock, no DOM. Source: PLAN.md -> "Derived state".
// SHARED CONTRACT: the type shapes here are integrator-only (see briefs/README.md).
// Brief A implements the function body. The picture depends only on plan + time:
// there is no health, damage or "behind" state (design/layout.md).
import type { Plan } from './schema';
import { clockFor, daysBetween, deadlineMs, HOUR_MS } from './time';

export type Phase = 'dormant' | 'awake' | 'enraged' | 'final' | 'now';
export type Sky = 'dawn' | 'day' | 'dusk' | 'night';
/** Which boss image is drawn. `final` in the last `phaseDays.final` days, else by sky. */
export type Variant = 'light' | 'dark' | 'final';

/** Waiting bosses shown in the left column; the rest collapse into "+N more". */
export const QUEUE_MAX = 3;

/** Hour (plan timezone) at which each sky starts. Night runs 20:00 to 04:59. */
export const SKY_START_HOUR = { dawn: 5, day: 9, dusk: 17, night: 20 } as const satisfies Record<
  Sky,
  number
>;

export interface BossState {
  id: string;
  title: string;
  short: string;
  /** Atlas key prefix. */
  sprite: string;
  deadline: string;
  /** Calendar-day difference in the plan's timezone; 0 on the day itself. */
  daysLeft: number;
  /** Whole hours remaining, never negative. */
  hoursLeft: number;
  /** True once fewer than 48 hours remain: the label shows hours instead of days. */
  showHours: boolean;
  phase: Phase;
  variant: Variant;
}

export interface NextStep {
  bossId: string;
  bossShort: string;
  stepId: string;
  label: string;
  /** YYYY-MM-DD. */
  due: string;
}

export interface SceneState {
  /** Boss with the nearest future deadline; null when no boss is visible. */
  front: BossState | null;
  /** Later deadlines in date order, at most QUEUE_MAX. */
  queue: BossState[];
  /** Number of waiting bosses that did not fit in `queue`. */
  queueOverflow: number;
  /**
   * Round timer for the front boss, 0..1. 1 while `phaseDays.awake` days or more remain,
   * falling linearly (by whole hours) to 0 at the deadline. 0 when there is no front boss.
   */
  timer: number;
  /** Soonest step with `due` today or later, across all visible bosses; ties by boss deadline. */
  nextStep: NextStep | null;
  sky: Sky;
  /** Copied from `settings.widgetFrame`. */
  widgetFrame: boolean;
}

export interface DeriveOptions {
  /**
   * Sprite prefixes that have finished art. When given, a boss whose `sprite` is not in the
   * set is hidden, exactly like a boss with `deadline: null` (design/art.md, "late art").
   */
  availableSprites?: ReadonlySet<string>;
}

/** `now` is epoch milliseconds. */
export function derive(_plan: Plan, _now: number, _options?: DeriveOptions): SceneState {
  const { settings } = _plan;
  const clock = clockFor(_plan.timezone);
  const { date: today, hour } = clock.local(_now);
  let sky: Sky;
  if (!settings.timeOfDay) sky = 'dusk';
  else if (hour < SKY_START_HOUR.dawn || hour >= SKY_START_HOUR.night) sky = 'night';
  else if (hour < SKY_START_HOUR.day) sky = 'dawn';
  else if (hour < SKY_START_HOUR.dusk) sky = 'day';
  else sky = 'dusk';

  const sprites = _options?.availableSprites;
  const visible = _plan.bosses
    .flatMap(boss => {
      const { deadline } = boss;
      if (deadline === null || (sprites && !sprites.has(boss.sprite))) return [];
      const at = deadlineMs(deadline);
      return at > _now ? [{ boss, deadline, at }] : [];
    })
    .sort((a, b) => a.at - b.at); // Stable sort preserves plan order for equal instants.

  const { awake, enraged, final, now } = settings.phaseDays;
  const [front, ...queue] = visible.slice(0, 1 + QUEUE_MAX).map(({ boss, deadline, at }): BossState => {
    const daysLeft = daysBetween(today, clock.local(at).date);
    const hoursLeft = Math.floor((at - _now) / HOUR_MS);
    let phase: Phase;
    if (hoursLeft < now * 24) phase = 'now';
    else if (daysLeft <= final) phase = 'final';
    else if (daysLeft <= enraged) phase = 'enraged';
    else if (daysLeft <= awake) phase = 'awake';
    else phase = 'dormant';

    // The time-of-day toggle controls only the sky and the Light/Dark swap; Final form
    // always shows close to the deadline (owner, Nov 22).
    let variant: Variant = 'light';
    if (phase === 'final' || phase === 'now') variant = 'final';
    else if (sky === 'night') variant = 'dark';
    const { id, short, title, sprite } = boss;
    return {
      id, short, title, sprite, deadline, daysLeft, hoursLeft,
      showHours: hoursLeft < 48, phase, variant,
    };
  });

  // Include overflow bosses. Break due-date ties by boss deadline, then step order;
  // a full tie keeps the first boss in the plan.
  const [next] = visible
    .flatMap(({ boss, at }) => boss.steps.map((step, index) => ({ boss, at, step, index })))
    .filter(({ step }) => step.due >= today)
    .sort((a, b) => {
      if (a.step.due !== b.step.due) return a.step.due < b.step.due ? -1 : 1;
      return a.at - b.at || a.index - b.index;
    });
  return {
    front: front ?? null,
    queue,
    queueOverflow: Math.max(0, visible.length - 1 - QUEUE_MAX),
    timer: front ? Math.min(1, front.hoursLeft / (awake * 24)) : 0,
    nextStep: next ? {
      bossId: next.boss.id,
      bossShort: next.boss.short,
      stepId: next.step.id,
      label: next.step.label,
      due: next.step.due,
    } : null,
    sky,
    widgetFrame: settings.widgetFrame,
  };
}
