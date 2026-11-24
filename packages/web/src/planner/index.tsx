// Planner tab. Owner: brief C.
import type { Boss, PlanSettings } from '@boss-rush/core';
import { fixturePlan } from '@boss-rush/core';
import { useMemo, useRef, useState } from 'preact/hooks';
import { shareUrl, usePlan } from '../store';
import { BossCard } from './BossCard';
import { downloadJsonFile, exportPlanJson, parsePlanJson } from './io';
import { RemindersSection } from './RemindersSection';
import { SettingsSection } from './SettingsSection';
import { getPlanValidation } from './validation';

export function Planner() {
  const [plan, setPlan] = usePlan();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const { allIssues, byPath, summary } = useMemo(() => getPlanValidation(plan), [plan]);

  const handleUpdateBoss = (index: number, updated: Boss) => {
    const nextBosses = [...plan.bosses];
    nextBosses[index] = updated;
    setPlan({ ...plan, bosses: nextBosses });
  };

  const handleRemoveBoss = (index: number) => {
    const target = plan.bosses[index];
    if (plan.bosses.length <= 1) {
      if (!window.confirm('A plan usually needs at least one boss. Remove anyway?')) return;
    } else if (target && target.steps.length > 0) {
      if (!window.confirm(`Remove boss "${target.title}" and its ${target.steps.length} step(s)?`)) return;
    }
    const nextBosses = plan.bosses.filter((_, i) => i !== index);
    setPlan({ ...plan, bosses: nextBosses });
  };

  const handleMoveBoss = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= plan.bosses.length) return;
    const nextBosses = [...plan.bosses];
    const temp = nextBosses[index]!;
    nextBosses[index] = nextBosses[targetIdx]!;
    nextBosses[targetIdx] = temp;
    setPlan({ ...plan, bosses: nextBosses });
  };

  const handleAddBoss = () => {
    if (plan.bosses.length >= 6) return;
    const id = `boss_${Date.now()}`;
    const newBoss: Boss = {
      id,
      title: 'New Deadline',
      short: 'NEW',
      subject: 'general',
      deadline: null,
      sprite: `boss_${id}`,
      steps: [],
    };
    setPlan({ ...plan, bosses: [...plan.bosses, newBoss] });
  };

  const handleUpdateSettings = (settings: PlanSettings) => {
    setPlan({ ...plan, settings });
  };

  const handleUpdateTimezone = (timezone: string) => {
    setPlan({ ...plan, timezone });
  };

  const handleExport = () => {
    downloadJsonFile('deadlines.json', exportPlanJson(plan));
  };

  const handleCopyShareLink = async () => {
    try {
      const url = shareUrl(plan);
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback if clipboard API unavailable
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all deadlines and settings to the default sample plan? Any unsaved edits will be replaced.')) {
      setPlan(fixturePlan);
      setImportMessage({ type: 'ok', text: 'Reset to sample plan.' });
      setTimeout(() => setImportMessage(null), 3000);
    }
  };

  const handleFileChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') return;
      const res = parsePlanJson(text);
      if (res.ok) {
        setPlan(res.plan);
        setImportMessage({ type: 'ok', text: `Loaded "${file.name}" successfully.` });
      } else {
        setImportMessage({ type: 'err', text: `Failed to import "${file.name}": ${res.error}` });
      }
      setTimeout(() => setImportMessage(null), 5000);
      input.value = '';
    };
    reader.onerror = () => {
      setImportMessage({ type: 'err', text: `Could not read file "${file.name}".` });
      setTimeout(() => setImportMessage(null), 5000);
      input.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <section style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Action Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginTop: '1rem',
          marginBottom: '1rem',
          padding: '0.5rem',
          backgroundColor: '#f0f0f0',
          borderRadius: '4px',
        }}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{ fontFamily: 'inherit', padding: '0.35rem 0.75rem' }}
        >
          Import file…
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <button
          type="button"
          onClick={handleExport}
          style={{ fontFamily: 'inherit', padding: '0.35rem 0.75rem' }}
        >
          Export deadlines.json
        </button>

        <button
          type="button"
          onClick={handleCopyShareLink}
          style={{ fontFamily: 'inherit', padding: '0.35rem 0.75rem' }}
        >
          {copiedLink ? '✓ Share link copied!' : 'Copy share link'}
        </button>

        <button
          type="button"
          onClick={handleReset}
          style={{ fontFamily: 'inherit', padding: '0.35rem 0.75rem', color: '#888' }}
        >
          Reset to sample
        </button>
      </div>

      {/* Import / Action feedback banner */}
      {importMessage && (
        <div
          style={{
            padding: '0.5rem 0.75rem',
            marginBottom: '1rem',
            borderRadius: '4px',
            backgroundColor: importMessage.type === 'ok' ? '#e6f9e6' : '#ffebe6',
            color: importMessage.type === 'ok' ? '#006600' : '#c00000',
            border: `1px solid ${importMessage.type === 'ok' ? '#a3d9a3' : '#ffb3a6'}`,
            fontSize: '0.9rem',
          }}
        >
          {importMessage.text}
        </div>
      )}

      {/* Validation Summary Banner */}
      {summary.length > 0 && (
        <div
          style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            backgroundColor: '#fff4e5',
            border: '1px solid #ffd599',
            borderRadius: '4px',
            fontSize: '0.85rem',
          }}
        >
          <strong style={{ color: '#b35900' }}>
            Plan has {allIssues.length} issue{allIssues.length === 1 ? '' : 's'} (you can still edit and save):
          </strong>
          <ul style={{ margin: '0.3rem 0 0 1.2rem', padding: 0 }}>
            {summary.map((item, idx) => (
              <li key={idx} style={{ color: '#804000', marginBottom: '0.15rem' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Settings Section */}
      <SettingsSection
        timezone={plan.timezone}
        settings={plan.settings}
        issueMap={byPath}
        onTimezoneChange={handleUpdateTimezone}
        onSettingsChange={handleUpdateSettings}
      />

      {/* Deadlines Section */}
      <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
              Deadlines & Bosses ({plan.bosses.length}/6)
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#666' }}>
              The earliest deadline becomes the front boss you face; the next three wait in line.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddBoss}
            disabled={plan.bosses.length >= 6}
            style={{
              fontFamily: 'inherit',
              fontWeight: 'bold',
              padding: '0.4rem 0.8rem',
            }}
          >
            + Add Deadline
          </button>
        </div>

        {plan.bosses.length === 0 ? (
          <div
            style={{
              padding: '1.5rem',
              border: '1px dashed #ccc',
              textAlign: 'center',
              color: '#888',
              borderRadius: '4px',
            }}
          >
            No bosses or deadlines in this plan. Click “+ Add Deadline” above to add one.
          </div>
        ) : (
          plan.bosses.map((boss, idx) => (
            <BossCard
              key={boss.id}
              boss={boss}
              index={idx}
              total={plan.bosses.length}
              timezone={plan.timezone}
              issueMap={byPath}
              onChange={(updated) => handleUpdateBoss(idx, updated)}
              onRemove={() => handleRemoveBoss(idx)}
              onMoveUp={() => handleMoveBoss(idx, 'up')}
              onMoveDown={() => handleMoveBoss(idx, 'down')}
            />
          ))
        )}
      </div>

      {/* Apple Reminders Checklist Section */}
      <RemindersSection plan={plan} />
    </section>
  );
}
