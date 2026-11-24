import { PROFILE_NAMES } from '@boss-rush/core';
import type { Motion, PlanSettings } from '@boss-rush/core';

interface SettingsSectionProps {
  timezone: string;
  settings: PlanSettings;
  issueMap: Map<string, string[]>;
  onTimezoneChange: (tz: string) => void;
  onSettingsChange: (settings: PlanSettings) => void;
}

const COMMON_TIMEZONES = [
  'America/Los_Angeles',
  'America/New_York',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Ho_Chi_Minh',
  'Australia/Sydney',
  'UTC',
];

const DEVICE_PRESETS = [
  { name: 'iPhone 16 Pro (1179 x 2556)', width: 1179, height: 2556 },
  { name: 'iPhone 15 / 14 Pro (1179 x 2556)', width: 1179, height: 2556 },
  { name: 'iPhone 14 / 13 (1170 x 2532)', width: 1170, height: 2532 },
  { name: 'iPhone SE (750 x 1334)', width: 750, height: 1334 },
  { name: 'iPad Pro 11″ (1668 x 2388)', width: 1668, height: 2388 },
  { name: 'iPad Pro 13″ (2048 x 2732)', width: 2048, height: 2732 },
];

export function SettingsSection({
  timezone,
  settings,
  issueMap,
  onTimezoneChange,
  onSettingsChange,
}: SettingsSectionProps) {
  const tzIssues = issueMap.get('timezone') ?? [];
  const profileIssues = issueMap.get('settings.profile') ?? [];
  const widthIssues = issueMap.get('settings.device.width') ?? [];
  const heightIssues = issueMap.get('settings.device.height') ?? [];
  const motionIssues = issueMap.get('settings.motion') ?? [];

  return (
    <section
      style={{
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '0.75rem',
        marginBottom: '1rem',
        backgroundColor: '#fafafa',
      }}
    >
      <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem 0' }}>Plan Settings</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        {/* Time Zone */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
            Time Zone:
          </label>
          <input
            type="text"
            list="tz-list"
            value={timezone}
            onInput={(e) => onTimezoneChange((e.target as HTMLInputElement).value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              padding: '0.3rem',
              borderColor: tzIssues.length ? '#d00' : '#ccc',
            }}
          />
          <datalist id="tz-list">
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
          {tzIssues.map((msg, i) => (
            <div key={i} style={{ color: '#d00', fontSize: '0.75rem' }}>
              {msg}
            </div>
          ))}
        </div>

        {/* Layout Profile */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
            Layout Profile:
          </label>
          <select
            value={settings.profile}
            onChange={(e) => onSettingsChange({ ...settings, profile: (e.target as HTMLSelectElement).value })}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              padding: '0.3rem',
              borderColor: profileIssues.length ? '#d00' : '#ccc',
            }}
          >
            {PROFILE_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {profileIssues.map((msg, i) => (
            <div key={i} style={{ color: '#d00', fontSize: '0.75rem' }}>
              {msg}
            </div>
          ))}
        </div>

        {/* Device Resolution */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
            Device Size (px):
          </label>
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            <input
              type="number"
              value={settings.device.width}
              onInput={(e) =>
                onSettingsChange({
                  ...settings,
                  device: { ...settings.device, width: Number((e.target as HTMLInputElement).value) },
                })
              }
              style={{ width: '48%', fontFamily: 'inherit', padding: '0.3rem' }}
              placeholder="W"
            />
            <span>×</span>
            <input
              type="number"
              value={settings.device.height}
              onInput={(e) =>
                onSettingsChange({
                  ...settings,
                  device: { ...settings.device, height: Number((e.target as HTMLInputElement).value) },
                })
              }
              style={{ width: '48%', fontFamily: 'inherit', padding: '0.3rem' }}
              placeholder="H"
            />
          </div>
          <div style={{ marginTop: '0.2rem' }}>
            <select
              onChange={(e) => {
                const preset = DEVICE_PRESETS.find((p) => p.name === (e.target as HTMLSelectElement).value);
                if (preset) {
                  onSettingsChange({
                    ...settings,
                    device: { width: preset.width, height: preset.height },
                  });
                }
              }}
              style={{ fontSize: '0.75rem', fontFamily: 'inherit', width: '100%' }}
            >
              <option value="">Choose device preset…</option>
              {DEVICE_PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {widthIssues.concat(heightIssues).map((msg, i) => (
            <div key={i} style={{ color: '#d00', fontSize: '0.75rem' }}>
              {msg}
            </div>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.timeOfDay}
            onChange={(e) =>
              onSettingsChange({ ...settings, timeOfDay: (e.target as HTMLInputElement).checked })
            }
          />
          <span style={{ fontSize: '0.85rem' }}>Time-of-day sky & pictures (dawn/day/dusk/night)</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.widgetFrame}
            onChange={(e) =>
              onSettingsChange({ ...settings, widgetFrame: (e.target as HTMLInputElement).checked })
            }
          />
          <span style={{ fontSize: '0.85rem' }}>Pixel-art widget frame</span>
        </label>
      </div>

      {/* Advanced Settings */}
      <details style={{ marginTop: '0.75rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
          Advanced settings (phase thresholds, motion)
        </summary>
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem',
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '3px',
          }}
        >
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#555' }}>
            Phase thresholds (days before deadline):
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem' }}>Awake (days):</label>
              <input
                type="number"
                value={settings.phaseDays.awake}
                onInput={(e) =>
                  onSettingsChange({
                    ...settings,
                    phaseDays: { ...settings.phaseDays, awake: Number((e.target as HTMLInputElement).value) },
                  })
                }
                style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', padding: '0.2rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem' }}>Enraged (days):</label>
              <input
                type="number"
                value={settings.phaseDays.enraged}
                onInput={(e) =>
                  onSettingsChange({
                    ...settings,
                    phaseDays: { ...settings.phaseDays, enraged: Number((e.target as HTMLInputElement).value) },
                  })
                }
                style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', padding: '0.2rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem' }}>Final form (days):</label>
              <input
                type="number"
                value={settings.phaseDays.final}
                onInput={(e) =>
                  onSettingsChange({
                    ...settings,
                    phaseDays: { ...settings.phaseDays, final: Number((e.target as HTMLInputElement).value) },
                  })
                }
                style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', padding: '0.2rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem' }}>Now (days):</label>
              <input
                type="number"
                value={settings.phaseDays.now}
                onInput={(e) =>
                  onSettingsChange({
                    ...settings,
                    phaseDays: { ...settings.phaseDays, now: Number((e.target as HTMLInputElement).value) },
                  })
                }
                style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', padding: '0.2rem' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              Motion mode:
            </label>
            <select
              value={settings.motion}
              onChange={(e) =>
                onSettingsChange({ ...settings, motion: (e.target as HTMLSelectElement).value as Motion })
              }
              style={{ fontFamily: 'inherit', padding: '0.2rem' }}
            >
              {(['off', 'wake', 'tap', 'tilt'] as Motion[]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {motionIssues.map((msg, i) => (
              <div key={i} style={{ color: '#d00', fontSize: '0.75rem' }}>
                {msg}
              </div>
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}
