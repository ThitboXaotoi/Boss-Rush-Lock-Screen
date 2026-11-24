import { describe, expect, it } from 'vitest';
import { fixturePlan, PROFILE_NAMES, validatePlan, type Plan } from '../src';

const step = { id: 'prep', label: 'Prep', due: '2026-11-23' };
const boss = {
  id: 'a', title: 'Art project', short: 'ART', subject: '', sprite: 'boss_art',
  deadline: '2026-11-24T00:30:00Z', steps: [step], // Nov 23 in Los Angeles
};
const plan: Plan = {
  version: 1, timezone: 'America/Los_Angeles', bosses: [boss],
  settings: {
    phaseDays: { awake: 14, enraged: 7, final: 3, now: 1 },
    motion: 'off', profile: 'compact', device: { width: 1179, height: 2556 },
    timeOfDay: true, widgetFrame: false,
  },
};
const settings = (changes: object) => ({ ...plan, settings: { ...plan.settings, ...changes } });
const phases = (changes: object) => settings({ phaseDays: { ...plan.settings.phaseDays, ...changes } });
const withBoss = (changes: object) => ({ ...plan, bosses: [{ ...boss, ...changes }] });
const withStep = (changes: object) => withBoss({ steps: [{ ...step, ...changes }] });

describe('validatePlan', () => {
  it('accepts the fixture plan', () => {
    expect(validatePlan(fixturePlan)).toEqual([]);
  });

  it('accepts the inclusive limits and lets different bosses reuse a step ID', () => {
    const sixSteps = Array.from({ length: 6 }, (_, i) => ({ ...step, id: `s${i}`, label: '12345678901234' }));
    const sixBosses = Array.from({ length: 6 }, (_, i) => ({ ...boss, id: `b${i}`, short: '12345', steps: sixSteps }));
    expect(validatePlan({ ...phases({ final: 1, now: 1 }), bosses: sixBosses })).toEqual([]);
    expect(validatePlan(withBoss({ deadline: null, steps: [] }))).toEqual([]);
    expect(validatePlan(withBoss({ deadline: null, steps: [{ ...step, due: '2028-02-29' }] }))).toEqual([]);
  });

  it('accepts the named profiles and motion modes', () => {
    for (const profile of PROFILE_NAMES) expect(validatePlan(settings({ profile }))).toEqual([]);
    for (const motion of ['off', 'wake', 'tap', 'tilt']) expect(validatePlan(settings({ motion }))).toEqual([]);
  });

  it('compares step dates to the deadline in the plan zone, not the date written in its offset', () => {
    expect(validatePlan(plan)).toEqual([]);
    expect(validatePlan(withStep({ due: '2026-11-24' }))).toEqual([
      { path: 'bosses[0].steps[0].due', message: expect.stringContaining('2026-11-23') },
    ]);
    expect(validatePlan(withBoss({
      deadline: '2026-11-23T23:30-10:00', steps: [{ ...step, due: '2026-11-24' }],
    }))).toEqual([]);
  });

  it.each<[string, unknown]>([
    ['version', { ...plan, version: '1' }],
    ['timezone', { ...plan, timezone: 'Mars/Base' }],
    ['timezone', { ...plan, timezone: '+08:00' }],
    ['timezone', { ...plan, timezone: undefined }],
    ['settings', { ...plan, settings: null }],
    ['settings.phaseDays', settings({ phaseDays: [] })],
    ['settings.phaseDays.awake', phases({ awake: 14.5 })],
    ['settings.phaseDays.enraged', phases({ enraged: '7' })],
    ['settings.phaseDays.final', phases({ final: 2.5 })],
    ['settings.phaseDays.now', phases({ now: 0 })],
    ['settings.phaseDays.awake', phases({ awake: 7 })],
    ['settings.phaseDays.enraged', phases({ enraged: 3 })],
    ['settings.phaseDays.final', phases({ final: 1, now: 2 })],
    ['settings.motion', settings({ motion: 'bounce' })],
    ['settings.profile', settings({ profile: 'missing' })],
    ['settings.device', settings({ device: null })],
    ['settings.device.width', settings({ device: { width: 0, height: 120 } })],
    ['settings.device.height', settings({ device: { width: 120, height: 5.5 } })],
    ['settings.timeOfDay', settings({ timeOfDay: 'true' })],
    ['settings.widgetFrame', settings({ widgetFrame: 0 })],
    ['bosses', { ...plan, bosses: {} }],
    ['bosses', { ...plan, bosses: [] }],
    ['bosses', { ...plan, bosses: Array(7).fill(boss) }],
    ['bosses[0]', { ...plan, bosses: [null] }],
    ['bosses[0].id', withBoss({ id: ' ' })],
    ['bosses[1].id', { ...plan, bosses: [boss, { ...boss }] }],
    ['bosses[0].title', withBoss({ title: '' })],
    ['bosses[0].short', withBoss({ short: '' })],
    ['bosses[0].short', withBoss({ short: '123456' })],
    ['bosses[0].subject', withBoss({ subject: {} })],
    ['bosses[0].sprite', withBoss({ sprite: 'ART-1' })],
    ['bosses[0].sprite', withBoss({ sprite: '' })],
    ['bosses[0].deadline', withBoss({ deadline: undefined })],
    ['bosses[0].deadline', withBoss({ deadline: '2026-11-23' })],
    ['bosses[0].deadline', withBoss({ deadline: '2026-11-23T23:59' })],
    ['bosses[0].deadline', withBoss({ deadline: '2026-02-30T23:59Z' })],
    ['bosses[0].deadline', withBoss({ deadline: '2026-11-23T24:01Z' })],
    ['bosses[0].deadline', withBoss({ deadline: '2026-11-23T23:59+08:75' })],
    ['bosses[0].steps', withBoss({ steps: false })],
    ['bosses[0].steps', withBoss({ steps: Array(7).fill(step) })],
    ['bosses[0].steps[0]', withBoss({ steps: [null] })],
    ['bosses[0].steps[0].id', withStep({ id: undefined })],
    ['bosses[0].steps[1].id', withBoss({ steps: [step, { ...step }] })],
    ['bosses[0].steps[0].label', withStep({ label: '' })],
    ['bosses[0].steps[0].label', withStep({ label: '123456789012345' })],
    ['bosses[0].steps[0].due', withStep({ due: '2026-2-03' })],
    ['bosses[0].steps[0].due', withStep({ due: '2026-02-29' })],
    ['bosses[0].steps[0].due', withStep({ due: '2026-00-01' })],
    ['bosses[0].steps[0].due', withStep({ due: '2026-11-23T00:00Z' })],
  ])('points to the invalid field: %s (case %#)', (path, input) => {
    expect(validatePlan(input)).toContainEqual({ path, message: expect.stringMatching(/\S/) });
  });

  it('returns actionable issues without throwing on malformed or unreadable input', () => {
    const unreadable = { get settings() { throw new Error('unreadable'); } };
    for (const input of [null, 'hello', {}, [], undefined, Symbol(), unreadable]) {
      const issues = validatePlan(input);
      expect(issues.length).toBeGreaterThan(0);
      for (const issue of issues) {
        expect(typeof issue.path).toBe('string');
        expect(issue.message).toMatch(/\S/);
      }
    }
  });

  it('still checks other fields when the time zone is invalid', () => {
    const issues = validatePlan({ ...withStep({ due: 'today' }), timezone: 'not a zone' });
    expect(issues.map(i => i.path)).toEqual(['timezone', 'bosses[0].steps[0].due']);
  });
});
