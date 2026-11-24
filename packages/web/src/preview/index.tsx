// Preview tab (brief D): the phone a judge sees first, with controls to move through time.
// It must never show an error: derive() runs guarded (fixture fallback in scene.ts) and the
// render call is guarded here. Positions of the fake clock and widgets come from
// profile.zones through fit() (overlay.ts), never from numbers typed here.
import { DEFAULT_PROFILE, neutrals, profiles, skyRamps } from '@boss-rush/core';
import type { Plan, Profile, ProfileName, Sky } from '@boss-rush/core';
import { render } from '@boss-rush/render';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { availableSprites, getAtlas } from '../atlas';
import { usePlan } from '../store';
import { cssColor, drawPreview, hasChrome } from './draw';
import type { ChromeSwitches } from './draw';
import { sceneForPlan, sceneWords } from './scene';
import { civilDate, epochForSlider, formatCivil, formatDayLabel, maxDayIndex, sliderForEpoch } from './time';
import type { SliderTime } from './time';

/** The preview canvas runs at this whole-number multiple of the game size (spec 1). */
const PREVIEW_BUFFER_SCALE = 2;
/** Idle animation speed (spec 8: 6 to 8 frames a second). */
const IDLE_FPS = 7;
/** Idle frame count, a guess until brief B states one (status file, "Needs from integrator"). */
const IDLE_FRAMES = 4;
/** Play speeds in simulated hours per second (spec 3: adjustable speed). */
const PLAY_SPEEDS = [1, 2, 4, 8, 16];

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
}

function planProfile(plan: Plan): Profile {
  return profiles[plan.settings.profile as ProfileName] ?? profiles[DEFAULT_PROFILE]!;
}

/** Last-resort picture: a flat sky, so the phone never goes blank. */
function drawFlat(canvas: HTMLCanvasElement, sky: Sky): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = cssColor(skyRamps[sky][1]);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export function Preview() {
  const [plan, savePlan] = usePlan();
  const timeZone = plan.timezone;

  // The real clock anchors the slider: day 0 is today in the plan's timezone.
  const [nowAnchor] = useState(() => Date.now());
  const day0 = useMemo(() => civilDate(nowAnchor, timeZone), [nowAnchor, timeZone]);

  const [sim, setSim] = useState<SliderTime>(() => sliderForEpoch(Date.now(), day0, timeZone));
  const simEpoch = useMemo(() => epochForSlider(sim, day0, timeZone), [sim, day0, timeZone]);
  const maxDay = useMemo(() => maxDayIndex(plan, nowAnchor), [plan, nowAnchor]);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [realSize, setRealSize] = useState(false);
  const [idleOn, setIdleOn] = useState(false);
  const [idleFrame, setIdleFrame] = useState(0);
  const [chrome, setChrome] = useState<ChromeSwitches>({
    statusBar: true,
    clock: true,
    widgets: true,
    notifications: true,
    buttons: true,
    layoutCheck: false,
  });
  const [fellBack, setFellBack] = useState(false);

  const reducedMotion = useMemo(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  // Could item (spec 7): preview another profile without saving it; "Save" is the only
  // thing that writes to the plan.
  const [profileChoice, setProfileChoice] = useState<'plan' | ProfileName>('plan');
  const profile = useMemo(
    () => (profileChoice === 'plan' ? planProfile(plan) : profiles[profileChoice] ?? planProfile(plan)),
    [plan, profileChoice],
  );
  const device = useMemo(
    () =>
      realSize
        ? { width: plan.settings.device.width, height: plan.settings.device.height }
        : {
            width: profile.logical.width * PREVIEW_BUFFER_SCALE,
            height: profile.logical.height * PREVIEW_BUFFER_SCALE,
          },
    [realSize, plan, profile],
  );

  const scene = useMemo(
    () => sceneForPlan(plan, simEpoch, { availableSprites: availableSprites() }),
    [plan, simEpoch],
  );

  // Play: one civil hour per step (spec 3), wrapping at the end of the range.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () => {
        setSim((s) => {
          const hour = s.hour + 1;
          if (hour <= 23) return { ...s, hour };
          return { day: s.day >= maxDay ? 0 : s.day + 1, hour: 0 };
        });
      },
      1000 / speed,
    );
    return () => clearInterval(id);
  }, [playing, speed, maxDay]);

  // Idle movement (spec 8): cycles the renderer's idle frames; off for reduced motion.
  useEffect(() => {
    if (!idleOn || reducedMotion) {
      setIdleFrame(0);
      return;
    }
    const id = setInterval(() => setIdleFrame((f) => (f + 1) % IDLE_FRAMES), 1000 / IDLE_FPS);
    return () => clearInterval(id);
  }, [idleOn, reducedMotion]);

  // The picture: render, then blit. Both calls are guarded; the flat-sky fallback keeps a
  // picture on the canvas whatever a plan, a stub or a browser does.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    setFellBack(scene.fallback);
    const el = canvasRef.current;
    if (!el) return;
    try {
      const frame = render(scene.scene, profile, getAtlas(), { device, idleFrame });
      drawPreview(el, {
        frame,
        profile,
        device,
        simEpoch,
        timeZone,
        scene: scene.scene,
        switches: chrome,
      });
    } catch {
      drawFlat(el, scene.scene.sky);
    }
  }, [scene, profile, device, simEpoch, timeZone, chrome, idleFrame]);

  const muted = cssColor(neutrals.steel);
  const labelStyle = { display: 'flex', alignItems: 'center', gap: '0.5rem' } as const;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
      <div
        style={{
          padding: '0.6rem',
          borderRadius: '2.4rem',
          border: `0.3rem solid ${cssColor(neutrals.ink)}`,
          background: cssColor(neutrals.black),
        }}
      >
        <div style={{ overflow: 'hidden', borderRadius: '2rem', lineHeight: 0 }}>
          <canvas
            ref={canvasRef}
            aria-label="Lock screen preview"
            style={{
              display: 'block',
              width: realSize ? 'auto' : `${device.width / PREVIEW_BUFFER_SCALE}px`,
              height: realSize ? '72vh' : `${device.height / PREVIEW_BUFFER_SCALE}px`,
              aspectRatio: `${device.width} / ${device.height}`,
              // Crisp mode upscales whole-number. Real size shrinks the exact export buffer
              // for inspection; the buffer itself is always whole-number fit() pixels.
              imageRendering: realSize ? 'auto' : 'pixelated',
            }}
          />
        </div>
      </div>
      {hasChrome(chrome) && (
        <p style={{ margin: 0, fontSize: '0.85rem', color: muted }}>
          Clock, widgets and notifications are fake samples — an approximation of iOS, not the real
          thing.
        </p>
      )}
      {fellBack && (
        <p style={{ margin: 0, fontSize: '0.85rem', color: muted }}>
          Stub picture: fixture scenes until the renderer lands; the time controls below are live.
        </p>
      )}
      <p style={{ margin: 0, fontWeight: 'bold' }}>{formatCivil(simEpoch, timeZone)}</p>
      <p style={{ margin: 0, color: muted }}>{sceneWords(scene.scene)}</p>

      <div style={{ display: 'grid', gap: '0.5rem', width: 'min(30rem, 100%)' }}>
        <label style={labelStyle}>
          Day
          <input
            type="range"
            min={0}
            max={maxDay}
            value={sim.day}
            aria-label="Simulated day"
            onInput={(e) => {
              setPlaying(false);
              setSim({ ...sim, day: clamp((e.target as HTMLInputElement).valueAsNumber, 0, maxDay) });
            }}
          />
          {formatDayLabel(sim.day, day0, timeZone)}
        </label>
        <label style={labelStyle}>
          Hour
          <input
            type="range"
            min={0}
            max={23}
            value={sim.hour}
            aria-label="Simulated hour"
            onInput={(e) => {
              setPlaying(false);
              setSim({ ...sim, hour: clamp((e.target as HTMLInputElement).valueAsNumber, 0, 23) });
            }}
          />
          {String(sim.hour).padStart(2, '0')}:00
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => {
              setPlaying(false);
              setSim(sliderForEpoch(Date.now(), day0, timeZone));
            }}
          >
            Now
          </button>
          <button onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</button>
          <label>
            Speed
            <select value={speed} onChange={(e) => setSpeed(Number((e.target as HTMLSelectElement).value))}>
              {PLAY_SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s} h/s
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={realSize}
              onChange={(e) => setRealSize((e.target as HTMLInputElement).checked)}
            />
            Real size ({plan.settings.device.width}×{plan.settings.device.height})
          </label>
        </div>

        <fieldset style={{ display: 'grid', gap: '0.3rem' }}>
          <legend>Lock screen overlay (fake)</legend>
          {(
            [
              ['statusBar', 'Status bar'],
              ['clock', 'Clock'],
              ['widgets', 'Widgets'],
              ['notifications', 'Notifications'],
              ['buttons', 'Bottom buttons'],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={chrome[key]}
                onChange={(e) => {
                  const checked = (e.target as HTMLInputElement).checked;
                  setChrome((c) => ({ ...c, [key]: checked }));
                }}
              />
              {label}
            </label>
          ))}
        </fieldset>

        <label>
          <input
            type="checkbox"
            checked={chrome.layoutCheck}
            onChange={(e) => {
              const checked = (e.target as HTMLInputElement).checked;
              setChrome((c) => ({ ...c, layoutCheck: checked }));
            }}
          />
          Layout check (outline every zone)
        </label>

        <fieldset style={{ display: 'grid', gap: '0.3rem' }}>
          <legend>Extras (preview only)</legend>
          <label>
            Profile
            <select
              value={profileChoice}
              onChange={(e) =>
                setProfileChoice((e.target as HTMLSelectElement).value as 'plan' | ProfileName)
              }
            >
              <option value="plan">as in plan ({plan.settings.profile})</option>
              {Object.keys(profiles).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {profileChoice !== 'plan' && profileChoice !== plan.settings.profile && (
            <button
              onClick={() => {
                savePlan({ ...plan, settings: { ...plan.settings, profile: profileChoice } });
                setProfileChoice('plan');
              }}
            >
              Save {profileChoice} to plan
            </button>
          )}
          <label title="Cycles the renderer's idle animation frames">
            <input
              type="checkbox"
              checked={idleOn}
              disabled={reducedMotion}
              onChange={(e) => setIdleOn((e.target as HTMLInputElement).checked)}
            />
            Idle movement{reducedMotion ? ' (browser asks for reduced motion)' : ''}
          </label>
        </fieldset>
      </div>
    </section>
  );
}
