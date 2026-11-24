// Fixed inputs shared by every package's tests and by the web app before real data exists.
// SHARED CONTRACT: integrator-only. Scenes are written by hand (not produced by derive) so
// render, preview and export can be built and golden-tested before brief A lands.
//
// Course names are the owner's (Nov 23); the dates are sample dates the owner chose so the
// demo shows each boss transform in turn: QSB Dec 2, MATH Dec 8, BIOE Dec 15, ??? Dec 25.
import type { BossState, SceneState } from './derive';
import type { Plan } from './schema';

export const fixturePlan: Plan = {
  version: 1,
  timezone: 'America/Los_Angeles',
  settings: {
    phaseDays: { awake: 14, enraged: 7, final: 3, now: 1 },
    motion: 'off',
    timeOfDay: true,
    profile: 'compact',
    device: { width: 1179, height: 2556 },
    widgetFrame: false,
  },
  bosses: [
    {
      id: 'lock',
      title: 'Countdown Lock Screen',
      short: 'LOCK',
      subject: 'design',
      deadline: '2026-11-23T23:59:00-08:00',
      sprite: 'boss_lock',
      steps: [
        { id: 'grid', label: 'Grid on phone', due: '2026-11-17' },
        { id: 'auto', label: 'Auto-update on', due: '2026-11-18' },
        { id: 'freeze', label: 'Feature freeze', due: '2026-11-20' },
        { id: 'submit', label: 'Submit entry', due: '2026-11-22' },
      ],
    },
    {
      id: 'qsb',
      title: 'QSB 278',
      short: 'QSB',
      subject: 'quantitative and systems biology',
      deadline: '2026-12-02T10:00:00-08:00',
      sprite: 'boss_qsb',
      steps: [
        { id: 'outline', label: 'Slide outline', due: '2026-11-27' },
        { id: 'dry', label: 'Dry run', due: '2026-12-01' },
      ],
    },
    {
      id: 'math',
      title: 'MATH 227',
      short: 'MATH',
      subject: 'math',
      deadline: '2026-12-08T09:00:00-08:00',
      sprite: 'boss_math',
      steps: [
        { id: 'ps', label: 'Problem sets', due: '2026-11-28' },
        { id: 'past', label: 'Past paper', due: '2026-12-05' },
      ],
    },
    {
      id: 'bioe',
      title: 'BIOE 240',
      short: 'BIOE',
      subject: 'bioengineering',
      deadline: '2026-12-15T13:00:00-08:00',
      sprite: 'boss_bioe',
      steps: [
        { id: 'notes', label: 'Review notes', due: '2026-12-01' },
        { id: 'mock', label: 'Mock exam', due: '2026-12-12' },
      ],
    },
    {
      // The final boss (design/bosses.md): its short name `???` hides the name and the
      // countdown on screen; the date is secret and only drives its forms (owner: Christmas).
      id: 'hood',
      title: '???',
      short: '???',
      subject: 'unknown',
      deadline: '2026-12-25T23:59:00-08:00',
      sprite: 'boss_hood',
      steps: [],
    },
  ],
};

function boss(
  id: string,
  short: string,
  title: string,
  deadline: string,
  daysLeft: number,
  hoursLeft: number,
  phase: BossState['phase'],
  variant: BossState['variant'],
): BossState {
  return {
    id,
    title,
    short,
    sprite: `boss_${id}`,
    deadline,
    daysLeft,
    hoursLeft,
    showHours: hoursLeft < 48,
    phase,
    variant,
  };
}

const LOCK = '2026-11-23T23:59:00-08:00';
const QSB = '2026-12-04T10:00:00-08:00';
const MATH = '2026-12-08T09:00:00-08:00';
const BIOE = '2026-12-10T13:00:00-08:00';

/** Six fixed scenes covering every sky, variant and phase, plus overflow and the empty screen. */
export const fixtureScenes = {
  /** Far deadline, day sky, Light boss, full timer, two waiting. */
  farDay: {
    front: boss('lock', 'LOCK', 'Countdown Lock Screen', LOCK, 20, 492, 'dormant', 'light'),
    queue: [
      boss('qsb', 'QSB', 'QSB 278', QSB, 31, 742, 'dormant', 'light'),
      boss('math', 'MATH', 'MATH 227', MATH, 35, 837, 'dormant', 'light'),
    ],
    queueOverflow: 0,
    timer: 1,
    nextStep: {
      bossId: 'lock',
      bossShort: 'LOCK',
      stepId: 'grid',
      label: 'Grid on phone',
      due: '2026-11-17',
    },
    sky: 'day',
    widgetFrame: false,
  },
  /** Awake at night: Dark boss, three waiting. */
  awakeNight: {
    front: boss('lock', 'LOCK', 'Countdown Lock Screen', LOCK, 10, 241, 'awake', 'dark'),
    queue: [
      boss('qsb', 'QSB', 'QSB 278', QSB, 21, 491, 'dormant', 'dark'),
      boss('math', 'MATH', 'MATH 227', MATH, 25, 586, 'dormant', 'dark'),
      boss('bioe', 'BIOE', 'BIOE 240', BIOE, 27, 638, 'dormant', 'dark'),
    ],
    queueOverflow: 0,
    timer: 0.72,
    nextStep: {
      bossId: 'lock',
      bossShort: 'LOCK',
      stepId: 'grid',
      label: 'Grid on phone',
      due: '2026-11-17',
    },
    sky: 'night',
    widgetFrame: false,
  },
  /** Enraged at dusk, queue overflowing by two, widget frame on. */
  enragedDusk: {
    front: boss('lock', 'LOCK', 'Countdown Lock Screen', LOCK, 5, 126, 'enraged', 'light'),
    queue: [
      boss('qsb', 'QSB', 'QSB 278', QSB, 16, 376, 'dormant', 'light'),
      boss('math', 'MATH', 'MATH 227', MATH, 20, 471, 'dormant', 'light'),
      boss('bioe', 'BIOE', 'BIOE 240', BIOE, 22, 523, 'dormant', 'light'),
    ],
    queueOverflow: 2,
    timer: 0.38,
    nextStep: {
      bossId: 'lock',
      bossShort: 'LOCK',
      stepId: 'freeze',
      label: 'Feature freeze',
      due: '2026-11-20',
    },
    sky: 'dusk',
    widgetFrame: true,
  },
  /** Final form at dawn; fewer than 48 hours, so the label shows hours. */
  finalDawn: {
    front: boss('lock', 'LOCK', 'Countdown Lock Screen', LOCK, 1, 42, 'final', 'final'),
    queue: [
      boss('qsb', 'QSB', 'QSB 278', QSB, 12, 292, 'awake', 'light'),
      boss('math', 'MATH', 'MATH 227', MATH, 16, 387, 'dormant', 'light'),
    ],
    queueOverflow: 0,
    timer: 0.13,
    nextStep: {
      bossId: 'lock',
      bossShort: 'LOCK',
      stepId: 'submit',
      label: 'Submit entry',
      due: '2026-11-22',
    },
    sky: 'dawn',
    widgetFrame: false,
  },
  /** Last 24 hours, day sky, one waiting. The next step belongs to a waiting boss. */
  nowDay: {
    front: boss('lock', 'LOCK', 'Countdown Lock Screen', LOCK, 0, 5, 'now', 'final'),
    queue: [boss('qsb', 'QSB', 'QSB 278', QSB, 11, 255, 'awake', 'light')],
    queueOverflow: 0,
    timer: 0.01,
    nextStep: {
      bossId: 'qsb',
      bossShort: 'QSB',
      stepId: 'outline',
      label: 'Slide outline',
      due: '2026-11-27',
    },
    sky: 'day',
    widgetFrame: false,
  },
  /** No visible boss: every deadline has passed or none has art. */
  emptyNight: {
    front: null,
    queue: [],
    queueOverflow: 0,
    timer: 0,
    nextStep: null,
    sky: 'night',
    widgetFrame: false,
  },
} satisfies Record<string, SceneState>;

export type FixtureSceneName = keyof typeof fixtureScenes;
