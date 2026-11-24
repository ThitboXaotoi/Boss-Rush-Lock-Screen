// ArtBench tab (brief E). The owner drops a Gemini picture, tunes the import and downloads
// the sprite plus the settings that reproduce it.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { neutrals, skyRamps } from '@boss-rush/core';
import type { Rect, Rgb } from '@boss-rush/core';
import { importSprite } from '@boss-rush/tools/atlas';
import type { ImportResult, RgbaImage } from '@boss-rush/tools/atlas';
import {
  VARIANTS,
  defaultSizes,
  hexOf,
  parseHex,
  settingsFragment,
  variantOptions,
} from '@boss-rush/tools/atlas/import-settings';
import type { RawVariantSettings, VariantName } from '@boss-rush/tools/atlas/import-settings';
import { squareCrop } from './crop';
import { colourAt, downloadPng, downloadText, paint, pngBase64, readPngFile } from './image';

const DEFAULT_PALETTE = [...skyRamps.day, ...Object.values(neutrals)].map(hexOf).join('\n');
const CHECKER = 'repeating-conic-gradient(#c9c9c9 0% 25%, #f4f4f4 0% 50%) 50% / 16px 16px';
const SCALES = [1, 4, 7] as const;

type Imported = { result: ImportResult; raw: RawVariantSettings } | { error: string };

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const clampInt = (value: string, fallback: number, min: number, max: number): number => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return settled;
}

function SpriteView({ image, scale, label }: { image: RgbaImage; scale: number; label: string }) {
  const painted = useRef<RgbaImage | null>(null);
  const canvasRef = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    if (painted.current === image && canvas.width === image.width && canvas.height === image.height) return;
    paint(canvas, image);
    painted.current = image;
  };
  return (
    <figure style={{ margin: 0 }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: `${image.width * scale}px`,
          imageRendering: 'pixelated',
          background: CHECKER,
        }}
      />
      <figcaption style={{ fontSize: '0.8rem' }}>{label}</figcaption>
    </figure>
  );
}

function OriginalView({
  image,
  crop,
  pickActive,
  onCrop,
  onPick,
}: {
  image: RgbaImage;
  crop: Rect | null;
  pickActive: boolean;
  onCrop: (crop: Rect) => void;
  onPick: (colour: Rgb) => void;
}) {
  const painted = useRef<RgbaImage | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const canvasRef = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    if (painted.current === image && canvas.width === image.width && canvas.height === image.height) return;
    paint(canvas, image);
    painted.current = image;
  };

  const sourcePoint = (event: JSX.TargetedPointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    if (!canvas) return { x: 0, y: 0 };
    const bounds = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(image.width - 1, Math.floor(((event.clientX - bounds.left) / bounds.width) * image.width))),
      y: Math.max(0, Math.min(image.height - 1, Math.floor(((event.clientY - bounds.top) / bounds.height) * image.height))),
    };
  };

  const down = (event: JSX.TargetedPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { ...sourcePoint(event), moved: false };
  };
  const move = (event: JSX.TargetedPointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    if (!current) return;
    const point = sourcePoint(event);
    if (Math.abs(point.x - current.x) > 2 || Math.abs(point.y - current.y) > 2) current.moved = true;
    if (current.moved) onCrop(squareCrop(image, current.x, current.y, point.x, point.y));
  };
  const up = (event: JSX.TargetedPointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    drag.current = null;
    if (current && !current.moved && pickActive) {
      const point = sourcePoint(event);
      onPick(colourAt(image, point.x, point.y));
    }
  };

  return (
    <div style={{ position: 'relative', width: 'min(100%, 420px)' }}>
      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        style={{
          display: 'block',
          width: '100%',
          imageRendering: 'pixelated',
          cursor: pickActive ? 'crosshair' : 'grab',
          touchAction: 'none',
        }}
      />
      {crop && (
        <div
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            border: '2px solid #e83b3b',
            boxShadow: '0 0 0 1px #fff',
            left: `${(crop.x / image.width) * 100}%`,
            top: `${(crop.y / image.height) * 100}%`,
            width: `${(crop.w / image.width) * 100}%`,
            height: `${(crop.h / image.height) * 100}%`,
          }}
        />
      )}
    </div>
  );
}

export function ArtBench() {
  const sizes = useMemo(defaultSizes, []);
  const [sprite, setSprite] = useState('boss_lock');
  const [variant, setVariant] = useState<VariantName>('light');
  const [size, setSize] = useState(sizes.boss);
  const [colours, setColours] = useState(8);
  const [mode, setMode] = useState<'extract' | 'snap'>('extract');
  const [paletteText, setPaletteText] = useState(DEFAULT_PALETTE);
  const [background, setBackground] = useState<'auto' | Rgb>('auto');
  const [pickActive, setPickActive] = useState(false);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [scale, setScale] = useState<number>(4);
  const [compare, setCompare] = useState(false);
  const [source, setSource] = useState<RgbaImage | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<string | null>(null);

  useEffect(() => {
    setSize(variant === 'portrait' ? sizes.portrait : sizes.boss);
  }, [variant, sizes]);

  const paletteColours = useMemo(
    () => paletteText.split(/[\s,;]+/).filter(Boolean).map(parseHex).filter((colour): colour is Rgb => colour !== null),
    [paletteText],
  );
  const invalidPalette = useMemo(
    () => paletteText.split(/[\s,;]+/).filter(Boolean).filter((entry) => parseHex(entry) === null).length,
    [paletteText],
  );

  const rawSettings = useMemo<RawVariantSettings>(() => {
    const raw: RawVariantSettings = {
      colors: colours,
      mode,
      background: background === 'auto' ? 'auto' : hexOf(background),
    };
    if (mode === 'snap') raw.palette = paletteColours.map(hexOf);
    if (crop) raw.crop = crop;
    return raw;
  }, [colours, mode, background, paletteColours, crop]);

  const settledCrop = useDebounced(crop, 120);

  const imported = useMemo<Imported | null>(() => {
    if (!source) return null;
    const raw: RawVariantSettings = { ...rawSettings };
    if (settledCrop) raw.crop = settledCrop;
    else delete raw.crop;
    try {
      return { result: importSprite(source, variantOptions(raw, size)), raw };
    } catch (reason) {
      return { error: message(reason) };
    }
  }, [source, rawSettings, settledCrop, size]);

  const compared = useMemo(() => {
    if (!compare || !source) return null;
    const base: RawVariantSettings = { ...rawSettings };
    if (settledCrop) base.crop = settledCrop;
    else delete base.crop;
    try {
      return {
        fromArt: importSprite(source, variantOptions({ ...base, mode: 'extract' }, size)),
        snapped: importSprite(source, variantOptions({ ...base, mode: 'snap' }, size)),
      };
    } catch (reason) {
      return { error: message(reason) };
    }
  }, [compare, source, rawSettings, settledCrop, size]);

  async function loadFile(file: File): Promise<void> {
    setError(null);
    try {
      const image = await readPngFile(file);
      setSource(image);
      setFileName(file.name);
      setCrop(null);
      setBackground('auto');
      setPickActive(false);
    } catch (reason) {
      setError(message(reason));
    }
  }

  async function saveToProject(): Promise<void> {
    if (!imported || !('result' in imported)) return;
    setSaveState('Saving…');
    try {
      const responses = await Promise.all([
        fetch('/__art/save', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            file: `sprites/${sprite}_${variant}.png`,
            base64: pngBase64(imported.result.image),
          }),
        }),
        fetch('/__art/save', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            file: 'import.json',
            merge: true,
            json: settingsFragment(sprite, variant, imported.raw),
          }),
        }),
      ]);
      for (const response of responses) {
        const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!response.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      }
      setSaveState(
        `Saved ${sprite}_${variant}.png and import.json to art/export/. Run the import command again to rebuild the atlas.`,
      );
    } catch (reason) {
      setSaveState(
        `Save failed: ${message(reason)}. The dev hook must be switched on in packages/web/vite.config.ts (see status/E).`,
      );
    }
  }

  const hasResult = imported !== null && 'result' in imported;

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <header>
        <h2 style={{ margin: '0 0 0.25rem' }}>Art bench</h2>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          Drop a Gemini picture. The import crops it, removes the background, shrinks it to game
          pixels and reduces the colours. Download the sprite and the settings; nothing reaches the
          project until you do.
        </p>
      </header>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer?.files[0];
          if (file) void loadFile(file);
        }}
        style={{ border: '2px dashed #6b7294', padding: '0.75rem', display: 'grid', gap: '0.75rem' }}
      >
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="file"
            accept="image/png"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void loadFile(file);
            }}
          />
          <span>or drop a PNG here{fileName ? ` — now showing ${fileName}` : ''}</span>
        </label>
        {error && <p style={{ color: '#e83b3b', margin: 0 }}>{error}</p>}

        {source ? (
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <strong>Original</strong>
              <OriginalView
                image={source}
                crop={crop}
                pickActive={pickActive}
                onCrop={setCrop}
                onPick={(colour) => {
                  setBackground(colour);
                  setPickActive(false);
                }}
              />
              <p style={{ fontSize: '0.8rem', margin: '0.25rem 0 0', maxWidth: '420px' }}>
                {source.width} × {source.height} px. Drag a square box to crop; for the portrait,
                drag around the head so the command can cut it from the light picture.
              </p>
            </div>
            <div>
              <strong>Imported sprite</strong>
              {imported && 'result' in imported ? (
                <>
                  <SpriteView image={imported.result.image} scale={scale} label={`${sprite}_${variant}, ${size} × ${size}`} />
                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
                    {SCALES.map((option) => (
                      <button key={option} onClick={() => setScale(option)} aria-pressed={scale === option}>
                        {option}×{option === 7 ? ' (≈ phone)' : ''}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ color: '#e83b3b', maxWidth: '320px' }}>
                  {imported ? imported.error : 'Importing…'}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p style={{ margin: 0 }}>No picture yet. PNG is preferred; export an SVG at 1024 px or larger first.</p>
        )}
      </div>

      <fieldset style={{ display: 'grid', gap: '0.5rem', border: '1px solid #6b7294', padding: '0.75rem' }}>
        <legend>Settings</legend>
        <label>
          Sprite name{' '}
          <input value={sprite} onInput={(event) => setSprite(event.currentTarget.value)} />
        </label>
        <label>
          Version{' '}
          <select value={variant} onChange={(event) => setVariant(event.currentTarget.value as VariantName)}>
            {VARIANTS.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Output size{' '}
          <input
            type="number"
            min={1}
            max={512}
            value={size}
            onInput={(event) => setSize(clampInt(event.currentTarget.value, size, 1, 512))}
          />{' '}
          px
        </label>
        <label>
          Colours{' '}
          <input
            type="number"
            min={1}
            max={64}
            value={colours}
            onInput={(event) => setColours(clampInt(event.currentTarget.value, colours, 1, 64))}
          />
        </label>

        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <label>
            <input type="radio" name="mode" checked={mode === 'extract'} onChange={() => setMode('extract')} />{' '}
            Colours from the art
          </label>
          <label>
            <input type="radio" name="mode" checked={mode === 'snap'} onChange={() => setMode('snap')} />{' '}
            Snap to a palette
          </label>
        </div>
        {mode === 'snap' && (
          <label>
            Palette, one #rrggbb per line
            <textarea
              rows={6}
              value={paletteText}
              onInput={(event) => setPaletteText(event.currentTarget.value)}
              style={{ width: '100%', fontFamily: 'inherit' }}
            />
            {invalidPalette > 0 && (
              <span style={{ color: '#e83b3b' }}>{invalidPalette} entries are not #rrggbb.</span>
            )}
          </label>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>Background</strong>
          <button
            onClick={() => {
              setBackground('auto');
              setPickActive(false);
            }}
            aria-pressed={background === 'auto'}
          >
            Auto (from the corners)
          </button>
          <button onClick={() => setPickActive(!pickActive)} aria-pressed={pickActive}>
            Pick from the picture
          </button>
          {background !== 'auto' && (
            <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
              <span style={{ width: '1rem', height: '1rem', background: hexOf(background), border: '1px solid #000', display: 'inline-block' }} />
              {hexOf(background)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>Crop</strong>
          <span>{crop ? `${crop.x}, ${crop.y} — ${crop.w} × ${crop.h}` : 'whole picture'}</span>
          <button onClick={() => setCrop(null)} disabled={!crop}>Reset crop</button>
        </div>
      </fieldset>

      {imported && 'result' in imported && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div>
            <strong>Warnings</strong>
            {imported.result.warnings.length === 0 ? (
              <p style={{ margin: '0.25rem 0' }}>None.</p>
            ) : (
              <ul style={{ margin: '0.25rem 0', paddingLeft: '1.25rem' }}>
                {imported.result.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <strong>Colours used ({imported.result.colors.length})</strong>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              {imported.result.colors.map((colour) => (
                <span key={hexOf(colour)} style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center', fontSize: '0.8rem' }}>
                  <span style={{ width: '1.25rem', height: '1.25rem', background: hexOf(colour), border: '1px solid #000', display: 'inline-block' }} />
                  {hexOf(colour)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          disabled={!hasResult}
          onClick={() => {
            if (imported && 'result' in imported) downloadPng(`${sprite}_${variant}.png`, imported.result.image);
          }}
        >
          Download sprite PNG
        </button>
        <button
          disabled={!hasResult}
          onClick={() => {
            if (imported && 'result' in imported) {
              downloadText(
                `import-${sprite}-${variant}.json`,
                `${JSON.stringify(settingsFragment(sprite, variant, imported.raw), null, 2)}\n`,
              );
            }
          }}
        >
          Download settings JSON
        </button>
        {import.meta.env.DEV && (
          <button disabled={!hasResult || saveState === 'Saving…'} onClick={() => void saveToProject()}>
            Save to project (dev)
          </button>
        )}
      </div>
      {saveState && <p style={{ margin: 0 }}>{saveState}</p>}

      <fieldset style={{ border: '1px solid #6b7294', padding: '0.75rem' }}>
        <legend>Compare</legend>
        <label>
          <input type="checkbox" checked={compare} onChange={(event) => setCompare(event.currentTarget.checked)} />{' '}
          Show the art's own colours next to the palette colours, to settle the palette question.
        </label>
        {compare && compared && (
          'error' in compared ? (
            <p style={{ color: '#e83b3b' }}>{compared.error}</p>
          ) : (
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              <SpriteView image={compared.fromArt.image} scale={4} label={`From the art (${compared.fromArt.colors.length} colours)`} />
              <SpriteView image={compared.snapped.image} scale={4} label={`Snapped (${compared.snapped.colors.length} of ${paletteColours.length})`} />
            </div>
          )
        )}
      </fieldset>
    </section>
  );
}
