import { describe, expect, it } from 'vitest';
import { derive, fixturePlan, type Boss, type Plan, type Step } from '../src';

const deadline = '2026-11-23T23:59:00-08:00';
const pt = (dateTime: string) => Date.parse(`2026-11-${dateTime}-08:00`);

function boss(id: string, due: string | null = deadline, steps: Step[] = []): Boss {
  return { id, title: `Boss ${id}`, short: id.toUpperCase(), subject: '', sprite: `boss_${id}`, deadline: due, steps };
}

function step(id: string, due: string): Step {
  return { id, label: `Step ${id}`, due };
}

function plan(...bosses: Boss[]): Plan {
  return {
    ...fixturePlan,
    timezone: 'America/Los_Angeles',
    settings: {
      ...fixturePlan.settings,
      phaseDays: { awake: 14, enraged: 7, final: 3, now: 1 },
      timeOfDay: true,
      widgetFrame: false,
    },
    bosses,
  };
}

describe('derive', () => {
  it('keeps only future, parseable deadlines with available art; equal instants keep plan order', () => {
    const p = plan(
      boss('late', '2026-11-25T01:00:00Z'),
      boss('unset', null),
      boss('z', '2026-11-24T07:59:00Z'), // same instant as a
      boss('bad', 'not a date'),
      boss('noart', '2026-11-17T01:00:00Z'),
      boss('a'),
    );
    const order = p.bosses.map(b => b.id);
    const availableSprites = new Set(['boss_a', 'boss_z', 'boss_late', 'boss_bad', 'boss_unset']);
    const before = derive(p, pt('16T12:00'), { availableSprites });
    expect(before.front?.id).toBe('z');
    expect(before.queue.map(b => b.id)).toEqual(['a', 'late']);
    expect(derive(p, pt('16T12:00')).front?.id).toBe('noart');
    expect(derive(p, pt('23T23:59'), { availableSprites }).front?.id).toBe('late');
    expect(p.bosses.map(b => b.id)).toEqual(order);
  });

  it('shows three waiting bosses, counts two more, and considers their steps for NEXT', () => {
    const p = plan(...['a', 'b', 'c', 'd', 'e', 'f'].map(id => boss(id)));
    p.bosses[5]!.steps = [step('prep', '2026-11-17')];
    const scene = derive(p, pt('16T12:00'));
    expect(scene.front?.id).toBe('a');
    expect(scene.queue.map(b => b.id)).toEqual(['b', 'c', 'd']);
    expect(scene.queueOverflow).toBe(2);
    expect(scene.nextStep).toEqual({
      bossId: 'f', bossShort: 'F', stepId: 'prep', label: 'Step prep', due: '2026-11-17',
    });
  });

  it.each([
    ['08T23:59', 15, 360, 'dormant'],
    ['09T00:00', 14, 359, 'awake'],
    ['15T23:59', 8, 192, 'awake'],
    ['16T00:00', 7, 191, 'enraged'],
    ['19T23:59', 4, 96, 'enraged'],
    ['20T00:00', 3, 95, 'final'],
    ['22T23:59', 1, 24, 'final'],
    ['23T00:00', 0, 23, 'now'],
    ['23T23:58', 0, 0, 'now'],
  ] as const)('at %s local: %i calendar days, %i whole hours, phase %s', (at, daysLeft, hoursLeft, phase) => {
    expect(derive(plan(boss('a')), pt(at)).front).toMatchObject({ daysLeft, hoursLeft, phase });
  });

  it('switches the label at 47 h 59 min, not at 48 h', () => {
    const p = plan(boss('a'));
    expect(derive(p, pt('21T23:59')).front).toMatchObject({ hoursLeft: 48, showHours: false });
    expect(derive(p, pt('22T00:00')).front).toMatchObject({ hoursLeft: 47, showHours: true });
  });

  it('uses the configured thresholds and computes a separate phase and variant for waiting bosses', () => {
    const p = plan(
      boss('front', '2026-11-18T19:59:00-08:00'), // 47 h 59 min
      boss('near', '2026-11-24T20:00:00-08:00'),  // 8 days
      boss('mid', '2026-11-28T20:00:00-08:00'),   // 12 days
      boss('far', '2026-12-06T20:00:00-08:00'),   // 20 days
    );
    p.settings.phaseDays = { awake: 20, enraged: 12, final: 8, now: 2 };
    const scene = derive(p, pt('16T20:00'));
    expect(scene.front).toMatchObject({ phase: 'now', variant: 'final', showHours: true });
    expect(scene.queue.map(b => [b.phase, b.variant, b.showHours])).toEqual([
      ['final', 'final', false], ['enraged', 'dark', false], ['awake', 'dark', false],
    ]);
    expect(scene.timer).toBe(47 / (20 * 24));
    expect(derive(p, pt('16T10:00')).front?.variant).toBe('final');
  });

  it.each([
    ['04:59', 'night', 'dark'], ['05:00', 'dawn', 'light'],
    ['08:59', 'dawn', 'light'], ['09:00', 'day', 'light'],
    ['16:59', 'day', 'light'], ['17:00', 'dusk', 'light'],
    ['19:59', 'dusk', 'light'], ['20:00', 'night', 'dark'],
  ])('at %s local the sky is %s and a non-final boss is %s', (hour, sky, variant) => {
    expect(derive(plan(boss('a')), pt(`16T${hour}`))).toMatchObject({ sky, front: { variant } });
  });

  it('keeps the sky at dusk while each boss transforms at its Final threshold', () => {
    const p = plan(boss('a'), boss('b', '2026-11-24T23:59:00-08:00'));
    p.settings.timeOfDay = false;
    for (const at of ['16T12:00', '19T23:59']) {
      expect(derive(p, pt(at))).toMatchObject({ sky: 'dusk', front: { variant: 'light' } });
    }
    expect(derive(p, pt('20T00:00'))).toMatchObject({
      sky: 'dusk',
      front: { phase: 'final', variant: 'final' },
      queue: [{ phase: 'enraged', variant: 'light' }],
    });
    expect(derive(p, pt('23T02:00'))).toMatchObject({
      sky: 'dusk',
      front: { phase: 'now', variant: 'final' },
      queue: [{ phase: 'final', variant: 'final' }],
    });
  });

  it('fills, drains and empties the front timer at the deadline', () => {
    const p = plan(boss('a'));
    expect(derive(p, pt('08T23:59')).timer).toBe(1);
    expect(derive(p, pt('16T23:59')).timer).toBe(0.5);
    expect(derive(p, pt('23T23:58'))).toMatchObject({ front: { hoursLeft: 0 }, timer: 0 });
    expect(derive(p, pt('23T23:59'))).toMatchObject({ front: null, timer: 0 });
  });

  it('takes steps due today, changes at local midnight, and ignores hidden bosses', () => {
    const today = '2026-11-16';
    const p = plan(
      boss('unset', null, [step('unset', today)]),
      boss('past', '2026-11-16T12:00:00-08:00', [step('past', today)]),
      boss('noart', deadline, [step('noart', today)]),
      boss('front', deadline, [step('old', '2026-11-15'), step('later', '2026-11-17')]),
      boss('wait', '2026-11-25T12:00:00Z', [step('today', today)]),
    );
    const options = { availableSprites: new Set(['boss_unset', 'boss_past', 'boss_front', 'boss_wait']) };
    expect(derive(p, pt('16T23:59'), options).nextStep?.stepId).toBe('today');
    expect(derive(p, pt('17T00:00'), options).nextStep?.stepId).toBe('later');
    expect(derive(p, pt('18T00:00'), options).nextStep).toBeNull();
  });

  it('breaks NEXT ties by boss deadline, then original step order', () => {
    const due = '2026-11-17';
    const p = plan(
      boss('late', '2026-12-10T12:00:00Z', [step('a', due)]),
      boss('early', deadline, [step('z', due), step('b', due)]),
    );
    expect(derive(p, pt('16T12:00')).nextStep).toEqual({
      bossId: 'early', bossShort: 'EARLY', stepId: 'z', label: 'Step z', due,
    });
  });

  it('uses step order when two bosses have the same deadline and due date', () => {
    const due = '2026-11-17';
    const p = plan(
      boss('a', deadline, [step('later', '2026-11-19'), step('second', due)]),
      boss('b', deadline, [step('first', due)]),
      boss('c', deadline, [step('alsoFirst', due)]),
    );
    expect(derive(p, pt('16T12:00')).nextStep).toMatchObject({ bossId: 'b', stepId: 'first' });
  });

  it.each([false, true])('keeps widgetFrame=%s even in an empty scene', widgetFrame => {
    const p = plan(boss('a', deadline, [step('prep', '2026-11-17')]));
    p.settings.widgetFrame = widgetFrame;
    expect(derive(p, pt('16T21:00'), { availableSprites: new Set() })).toEqual({
      front: null, queue: [], queueOverflow: 0, timer: 0, nextStep: null, sky: 'night', widgetFrame,
    });
  });
});
