// Brief D tests: overlay rectangles equal the zone rectangles put through fit(), at the
// preview's crisp buffer size and at the plan's real device size.
import { compact, fit, glass } from '@boss-rush/core';
import { describe, expect, it } from 'vitest';
import { lockOverlay, NOTIFICATION_COUNT, zoneOverlays, zoneToCanvas } from './overlay';

const crisp = { width: 360, height: 780 }; // compact and glass at the preview's 2x buffer
const real = { width: 1179, height: 2556 }; // the fixture plan's device

describe('zone overlays', () => {
  it('equal the zone rectangles put through fit()', () => {
    for (const [profile, device] of [
      [compact, crisp],
      [compact, real],
      [glass, crisp],
    ] as const) {
      const { scale, cropX, cropY } = fit(profile, device);
      for (const { name, rect } of zoneOverlays(profile, device)) {
        const zone = profile.zones[name];
        expect(rect).toEqual({
          x: zone.x * scale - cropX,
          y: zone.y * scale - cropY,
          w: zone.w * scale,
          h: zone.h * scale,
        });
      }
    }
  });
});

describe('lock overlay', () => {
  it('sits the status bar, clock and widgets exactly on their zones', () => {
    const o = lockOverlay(compact, crisp);
    expect(o.statusBar).toEqual(zoneToCanvas(compact.zones.statusBar, compact, crisp));
    expect(o.clock).toEqual(zoneToCanvas(compact.zones.clock, compact, crisp));
    expect(o.widgets).toEqual(zoneToCanvas(compact.zones.widgets, compact, crisp));
  });

  it('stacks the sample notifications up from the bottom, above the buttons', () => {
    for (const device of [crisp, real] as const) {
      const o = lockOverlay(compact, device);
      expect(o.notifications).toHaveLength(NOTIFICATION_COUNT);
      const [left, right] = o.buttons;
      expect(left.y + left.h).toBe(device.height);
      expect(right.y + right.h).toBe(device.height);
      for (let i = 1; i < o.notifications.length; i++) {
        expect(o.notifications[i]!.y + o.notifications[i]!.h).toBeLessThanOrEqual(
          o.notifications[i - 1]!.y,
        );
      }
      // The whole stack stays on the canvas.
      expect(o.notifications.at(-1)!.y).toBeGreaterThanOrEqual(0);
    }
  });
});
