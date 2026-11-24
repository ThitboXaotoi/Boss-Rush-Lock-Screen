// Export tab. Owner: brief F. Everything the owner saves from the app: today's
// picture, the picture pack, a test pack, the calibration grid, the contest cover
// and the calendar file.
import { derive, fixtureScenes, packEntries, profiles } from '@boss-rush/core';
import type { PackEntry, Plan, SceneState } from '@boss-rush/core';
import { encodePng, render, renderGrid } from '@boss-rush/render';
import type { Frame } from '@boss-rush/render';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { availableSprites, getAtlas } from '../atlas';
import { usePlan } from '../store';
import { composeCover, COVER_PHONE, coverScenes } from './cover';
import { buildIcs } from './ics';
import { buildPackZip, entryForNow, limitToDates, packZipName } from './pack';
import {
  bytesUrl,
  formatBytes,
  pngUrl,
  renderScenePng,
  resolveProfile,
  textUrl,
} from './picture';

/** Draw a frame on a canvas with crisp pixels. */
function FrameCanvas({ frame, alt, height }: { frame: Frame; alt: string; height: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.width = frame.width;
    el.height = frame.height;
    el.getContext('2d')!.putImageData(
      new ImageData(new Uint8ClampedArray(frame.rgba), frame.width, frame.height),
      0,
      0,
    );
  }, [frame]);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={alt}
      style={{ height, imageRendering: 'pixelated', border: '1px solid #888' }}
    />
  );
}

/** Revoke the previous object URL whenever it changes, and on unmount. */
function useRevokedUrl(url: string | null): void {
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (prev.current && prev.current !== url) URL.revokeObjectURL(prev.current);
    prev.current = url;
  }, [url]);
  useEffect(
    () => () => {
      if (prev.current) URL.revokeObjectURL(prev.current);
    },
    [],
  );
}

function Section({
  title,
  about,
  children,
}: {
  title: string;
  about: string;
  children: ComponentChildren;
}) {
  return (
    <section style={{ borderTop: '1px solid #ccc', marginTop: '1rem', paddingTop: '0.5rem' }}>
      <h2 style={{ fontSize: '1rem', margin: '0 0 0.25rem' }}>{title}</h2>
      <p style={{ margin: '0 0 0.5rem' }}>{about}</p>
      {children}
    </section>
  );
}

/** Item 1 (Must): the picture for right now, shown and downloadable at device size. */
function TodayPicture({
  plan,
  now,
  entries,
}: {
  plan: Plan;
  now: number;
  entries: PackEntry[] | null;
}) {
  const atlas = getAtlas();
  const { profile, fellBack } = resolveProfile(plan);
  const device = plan.settings.device;
  const today = useMemo<{ scene: SceneState; sample: boolean }>(() => {
    try {
      return { scene: derive(plan, now, { availableSprites: availableSprites() }), sample: false };
    } catch {
      return { scene: fixtureScenes.farDay, sample: true };
    }
  }, [plan, now]);
  const { png, frame } = useMemo(
    () => renderScenePng(today.scene, profile, atlas, device),
    [today.scene, profile, atlas, device],
  );
  const url = useMemo(() => pngUrl(png), [png]);
  useRevokedUrl(url);
  const name =
    entryForNow(entries ?? [], now)?.fileName ??
    `BR_${new Date(now).toISOString().slice(0, 10)}_midnight.png`;
  return (
    <div>
      {today.sample && (
        <p>
          derive() is not available yet, so this is a sample scene — the layout and size are real.
        </p>
      )}
      {fellBack && <p>Layout “{plan.settings.profile}” is not built yet; showing compact.</p>}
      <p>
        {frame.width} x {frame.height}px ·{' '}
        <a href={url} download={name}>
          Download {name}
        </a>
      </p>
      <FrameCanvas frame={frame} alt="Today's lock screen picture" height="60vh" />
    </div>
  );
}

type PackState =
  | { stage: 'idle' }
  | { stage: 'building'; done: number; total: number }
  | { stage: 'done'; url: string; name: string; count: number; size: number }
  | { stage: 'error'; message: string }
  | { stage: 'cancelled' };

/** Item 2 (Should) and item 3 (Could): the full pack and the two-day test pack. */
function PackSection({
  title,
  about,
  plan,
  entries,
}: {
  title: string;
  about: string;
  plan: Plan;
  entries: PackEntry[] | null;
}) {
  const [state, setState] = useState<PackState>({ stage: 'idle' });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useRevokedUrl(state.stage === 'done' ? state.url : null);

  const deriveOk = useMemo(() => {
    try {
      derive(plan, Date.now(), { availableSprites: availableSprites() });
      return true;
    } catch {
      return false;
    }
  }, [plan]);

  if (entries === null) {
    return (
      <Section title={title} about={about}>
        <p>The pack list is not available yet (brief A has not landed).</p>
      </Section>
    );
  }

  const build = async () => {
    if (entries.length === 0 || !deriveOk) return;
    const current = new AbortController();
    controller.current = current;
    setState({ stage: 'building', done: 0, total: entries.length });
    try {
      const atlas = getAtlas();
      const { profile } = resolveProfile(plan);
      const device = plan.settings.device;
      const zip = await buildPackZip(
        entries,
        (entry) => {
          const scene = derive(plan, entry.at, { availableSprites: availableSprites() });
          return renderScenePng(scene, profile, atlas, device).png;
        },
        {
          signal: current.signal,
          onProgress: (p) => setState({ stage: 'building', done: p.done, total: p.total }),
        },
      );
      setState({
        stage: 'done',
        url: bytesUrl(zip, 'application/zip'),
        name: packZipName(entries),
        count: entries.length,
        size: zip.length,
      });
    } catch (err) {
      if (current.signal.aborted) setState({ stage: 'cancelled' });
      else setState({ stage: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <Section title={title} about={about}>
      <p>
        {entries.length} pictures, {packZipName(entries)}.
      </p>
      {!deriveOk && <p>Pictures are not available yet (brief A has not landed).</p>}
      {entries.length === 0 && <p>The plan has no dated deadlines, so the pack is empty.</p>}
      {state.stage === 'idle' || state.stage === 'cancelled' || state.stage === 'error' ? (
        <div>
          {state.stage === 'error' && <p>Build failed: {state.message}</p>}
          {state.stage === 'cancelled' && <p>Cancelled.</p>}
          <button
            onClick={build}
            disabled={entries.length === 0 || !deriveOk}
            style={{ fontFamily: 'inherit' }}
          >
            Build the pack
          </button>
        </div>
      ) : state.stage === 'building' ? (
        <div>
          <p>
            Rendering picture {state.done} of {state.total}…
          </p>
          <progress value={state.done} max={state.total} style={{ width: '100%' }} />
          <p>
            <button onClick={() => controller.current?.abort()} style={{ fontFamily: 'inherit' }}>
              Cancel
            </button>
          </p>
        </div>
      ) : (
        <p>
          {state.count} pictures, {formatBytes(state.size)} ·{' '}
          <a href={state.url} download={state.name}>
            Download {state.name}
          </a>
        </p>
      )}
    </Section>
  );
}

/** Item 4 (Could): the calibration grid for any profile and any device size. */
function GridSection({ plan }: { plan: Plan }) {
  const names = Object.keys(profiles);
  const [name, setName] = useState<string>(
    names.includes(plan.settings.profile) ? plan.settings.profile : 'compact',
  );
  const [width, setWidth] = useState(String(plan.settings.device.width));
  const [height, setHeight] = useState(String(plan.settings.device.height));
  const grid = useMemo(() => {
    const w = Number.parseInt(width, 10);
    const h = Number.parseInt(height, 10);
    const profile = (profiles as Record<string, (typeof profiles)['compact']>)[name];
    if (!profile || !Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) return null;
    const frame = renderGrid(profile, { width: w, height: h });
    return { frame, png: encodePng(frame), file: `BossRush_grid_${name}_${w}x${h}.png` };
  }, [name, width, height]);
  const url = useMemo(() => (grid ? pngUrl(grid.png) : null), [grid]);
  useRevokedUrl(url);
  return (
    <Section
      title="Calibration grid"
      about="A measuring grid for your exact screen — set it as wallpaper, screenshot the lock screen, and read off where the clock and widgets sit."
    >
      <p>
        <label>
          Layout:{' '}
          <select
            value={name}
            onChange={(e) => setName((e.target as HTMLSelectElement).value)}
            style={{ fontFamily: 'inherit' }}
          >
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Width:{' '}
          <input
            value={width}
            onInput={(e) => setWidth((e.target as HTMLInputElement).value)}
            size={6}
            style={{ fontFamily: 'inherit' }}
          />
        </label>{' '}
        <label>
          Height:{' '}
          <input
            value={height}
            onInput={(e) => setHeight((e.target as HTMLInputElement).value)}
            size={6}
            style={{ fontFamily: 'inherit' }}
          />
        </label>
      </p>
      {!grid || !url ? (
        <p>Enter a whole-number width and height above zero.</p>
      ) : (
        <div>
          <p>
            {grid.frame.width} x {grid.frame.height}px ·{' '}
            <a href={url} download={grid.file}>
              Download {grid.file}
            </a>
          </p>
          <FrameCanvas frame={grid.frame} alt="Calibration grid" height="50vh" />
        </div>
      )}
    </Section>
  );
}

/** Item 5 (Could): the 2400 x 1600 contest cover, built from the renderer. */
function CoverSection({ plan, now }: { plan: Plan; now: number }) {
  const atlas = getAtlas();
  const { profile } = resolveProfile(plan);
  const cover = useMemo(() => {
    const scenes = coverScenes(plan, now, availableSprites());
    return composeCover([
      render(scenes[0], profile, atlas, { device: COVER_PHONE }),
      render(scenes[1], profile, atlas, { device: COVER_PHONE }),
      render(scenes[2], profile, atlas, { device: COVER_PHONE }),
    ]);
  }, [plan, now, profile, atlas]);
  const url = useMemo(() => pngUrl(encodePng(cover)), [cover]);
  useRevokedUrl(url);
  const file = 'BossRush_cover.png';
  return (
    <Section
      title="Contest cover"
      about="The contest cover image (2400 x 1600, phones only until brief B exports the title font) — upload it with your submission."
    >
      <p>
        {cover.width} x {cover.height}px ·{' '}
        <a href={url} download={file}>
          Download {file}
        </a>
      </p>
      <FrameCanvas frame={cover} alt="Contest cover: the same boss as Light, Dark and Final" height="40vh" />
    </Section>
  );
}

/** Item 6 (Could): the calendar file with every dated deadline. */
function IcsSection({ plan, now }: { plan: Plan; now: number }) {
  const ics = useMemo(() => buildIcs(plan, now), [plan, now]);
  const url = useMemo(() => textUrl(ics, 'text/calendar'), [ics]);
  useRevokedUrl(url);
  const count = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
  const file = 'BossRush_deadlines.ics';
  return (
    <Section
      title="Calendar file"
      about="Your deadlines as a calendar file — import it into Apple Calendar so each deadline shows up alongside the wallpaper."
    >
      <p>
        {count} events ·{' '}
        <a href={url} download={file}>
          Download {file}
        </a>
      </p>
    </Section>
  );
}

export function Export() {
  const [plan] = usePlan();
  const [now, setNow] = useState(() => Date.now());
  const entries = useMemo(() => {
    try {
      return packEntries(plan, now);
    } catch {
      return null;
    }
  }, [plan, now]);
  const testEntries = useMemo(() => {
    if (!entries) return null;
    const dates = [...new Set(entries.map((e) => e.date))].slice(0, 2);
    return limitToDates(entries, dates);
  }, [entries]);

  return (
    <div>
      <p>
        <button onClick={() => setNow(Date.now())} style={{ fontFamily: 'inherit' }}>
          Refresh to now
        </button>
      </p>
      <Section
        title="Today's picture"
        about="This is the picture for right now — on your iPhone, long-press it and save it, then set it as your lock screen wallpaper."
      >
        <TodayPicture plan={plan} now={now} entries={entries} />
      </Section>
      <PackSection
        title="Picture pack"
        about="This zip holds every picture from today to your last deadline — unzip it into a folder named BossRush in iCloud Drive so the Shortcuts automation finds each picture by name."
        plan={plan}
        entries={entries}
      />
      <PackSection
        title="Test pack (today and tomorrow)"
        about="A two-day mini pack for the phone test S7 — put it on the phone first to check the automatic wallpaper swap works before building the full pack."
        plan={plan}
        entries={testEntries}
      />
      <GridSection plan={plan} />
      <CoverSection plan={plan} now={now} />
      <IcsSection plan={plan} now={now} />
    </div>
  );
}
