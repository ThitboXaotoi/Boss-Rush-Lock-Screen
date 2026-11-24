import { Buffer } from 'node:buffer';
import { compact, fixtureScenes, glass, neutrals } from '@boss-rush/core';
import { expect, it } from 'vitest';
import { emptyAtlas, render } from '../src';
import { namePlateLabel, queueLabel } from '../src/layers/labels';

it.each([compact, glass])('hides days and hours and keeps a secret front timer full on $name', profile => {
  const scene = fixtureScenes.finalDawn;
  const front = { ...scene.front, short: '???' };
  const device = profile.logical;
  const { namePlate, timer } = profile.zones;
  const full = render({ ...scene, front, timer: 1 }, profile, emptyAtlas, { device });
  for (const showHours of [false, true]) {
    const boss = { ...front, showHours };
    expect(namePlateLabel(boss, namePlate.w)).toBe('??? ???');
    const frame = render({ ...scene, front: boss, timer: 0 }, profile, emptyAtlas, { device });
    expect(Buffer.from(frame.rgba).equals(full.rgba)).toBe(true);
    const lastTrackPixel = ((timer.y + 1) * device.width + timer.x + timer.w - 2) * 4;
    expect([...frame.rgba.subarray(lastTrackPixel, lastTrackPixel + 4)]).toEqual([...neutrals.warning, 255]);
  }
});

it('hides a waiting boss’s countdown without changing the ordinary front timer', () => {
  const scene = fixtureScenes.enragedDusk;
  const waiting = { ...scene.queue[0]!, short: '???' };
  const show = (showHours: boolean, timer: number) => render(
    { ...scene, queue: [{ ...waiting, showHours }], timer }, compact, emptyAtlas, { device: compact.logical },
  );
  for (const showHours of [false, true]) {
    expect(queueLabel({ ...waiting, showHours }, compact.zones.queue.w)).toBe('??? ???');
  }
  const emptyTimer = show(false, 0);
  expect(Buffer.from(emptyTimer.rgba).equals(show(true, 0).rgba)).toBe(true);
  expect(Buffer.from(emptyTimer.rgba).equals(show(false, 1).rgba)).toBe(false);
  const long = 'A title too long for the column';
  expect(queueLabel({ ...waiting, short: '??', title: long }, compact.zones.queue.w)).toBe('?? 16d');
});
