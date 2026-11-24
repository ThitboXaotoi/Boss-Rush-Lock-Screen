// The scene the preview shows: the real derive() (brief A), guarded so no plan and no
// control of this tab can produce an error (brief D, "Careful"). The fallback kept the
// tab alive before A landed and still covers a derive() that throws on an odd plan.
// The picture depends only on plan + time (AGENTS.md): there is no done state anywhere.
import { SKY_START_HOUR, derive, fixtureScenes } from '@boss-rush/core';
import type { DeriveOptions, Plan, SceneState, Sky } from '@boss-rush/core';
import { hasSecretDate } from '@boss-rush/render';
import { civilDateTime } from './time';

export interface SceneResult {
  scene: SceneState;
  /** True when derive() could not run and a fixture scene is shown instead. */
  fallback: boolean;
}

/** Sky for a wall-clock hour, from the same start hours derive() uses. */
export function skyForHour(hour: number): Sky {
  const { dawn, day, dusk, night } = SKY_START_HOUR;
  if (hour >= night || hour < dawn) return 'night';
  if (hour >= dusk) return 'dusk';
  if (hour >= day) return 'day';
  return 'dawn';
}

/**
 * derive() guarded (brief D spec 2). `options.availableSprites` carries the prefixes with
 * finished art, exactly like the exporter's call.
 */
export function sceneForPlan(plan: Plan, now: number, options?: DeriveOptions): SceneResult {
  try {
    return { scene: derive(plan, now, options), fallback: false };
  } catch {
    return { scene: fallbackScene(plan, now), fallback: true };
  }
}

/**
 * Fixture-scene picture, chosen by sky. Days left, the timer and the queue do not move
 * with the sliders in this mode (only the sky colour does, until real rendering lands).
 */
export function fallbackScene(plan: Plan, now: number): SceneState {
  if (!plan.bosses.some((boss) => boss.deadline)) return fixtureScenes.emptyNight;
  let hour = 12;
  if (Number.isFinite(now)) {
    try {
      hour = civilDateTime(now, plan.timezone).hour;
    } catch {
      // An unreadable time still gets a picture.
    }
  }
  const sky = plan.settings.timeOfDay ? skyForHour(hour) : 'dusk';
  if (sky === 'dawn') return fixtureScenes.finalDawn;
  if (sky === 'day') return fixtureScenes.farDay;
  if (sky === 'dusk') return fixtureScenes.enragedDusk;
  return fixtureScenes.awakeNight;
}

/** One short line: what the picture shows right now (brief D spec 4). */
export function sceneWords(scene: SceneState): string {
  const front = scene.front;
  if (!front) return `${scene.sky} sky · no boss visible · the arena is clear`;
  if (hasSecretDate(front)) {
    // A secret date stays secret here too: no countdown, no TIME share (design/bosses.md).
    return `${scene.sky} sky · ${front.variant} boss · ${front.phase} phase · ??? to the deadline · TIME ???`;
  }
  const left = front.showHours
    ? `${front.hoursLeft} h to the deadline`
    : `${front.daysLeft} day${front.daysLeft === 1 ? '' : 's'} to the deadline`;
  return `${scene.sky} sky · ${front.variant} boss · ${front.phase} phase · ${left} · TIME ${Math.round(scene.timer * 100)}%`;
}
