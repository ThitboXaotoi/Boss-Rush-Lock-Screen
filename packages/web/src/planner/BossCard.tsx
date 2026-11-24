import type { Boss, Step } from '@boss-rush/core';
import { useState } from 'preact/hooks';
import { proposeStepDates } from './backplan';
import { StepItem } from './StepItem';
import { formatDeadlineIso, parseDeadline } from './timezone';

interface BossCardProps {
  boss: Boss;
  index: number;
  total: number;
  timezone: string;
  issueMap: Map<string, string[]>;
  onChange: (updated: Boss) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function BossCard({
  boss,
  index,
  total,
  timezone,
  issueMap,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: BossCardProps) {
  const basePath = `bosses[${index}]`;
  const titleIssues = issueMap.get(`${basePath}.title`) ?? [];
  const shortIssues = issueMap.get(`${basePath}.short`) ?? [];
  const subjectIssues = issueMap.get(`${basePath}.subject`) ?? [];
  const spriteIssues = issueMap.get(`${basePath}.sprite`) ?? [];
  const deadlineIssues = issueMap.get(`${basePath}.deadline`) ?? [];
  const stepsIssues = issueMap.get(`${basePath}.steps`) ?? [];

  const parsedDeadline = parseDeadline(boss.deadline);
  const [hasDeadline, setHasDeadline] = useState(boss.deadline !== null);
  const [localDate, setLocalDate] = useState(parsedDeadline?.date ?? '2026-11-23');
  const [localTime, setLocalTime] = useState(parsedDeadline?.time ?? '23:59');

  const [showBackplan, setShowBackplan] = useState(false);
  const [backplanCount, setBackplanCount] = useState(boss.steps.length > 0 ? boss.steps.length : 3);

  const handleDeadlineToggle = (checked: boolean) => {
    setHasDeadline(checked);
    if (!checked) {
      onChange({ ...boss, deadline: null });
    } else {
      const iso = formatDeadlineIso(localDate, localTime, timezone);
      onChange({ ...boss, deadline: iso });
    }
  };

  const handleDateChange = (newDate: string) => {
    setLocalDate(newDate);
    if (hasDeadline) {
      const iso = formatDeadlineIso(newDate, localTime, timezone);
      onChange({ ...boss, deadline: iso });
    }
  };

  const handleTimeChange = (newTime: string) => {
    setLocalTime(newTime);
    if (hasDeadline) {
      const iso = formatDeadlineIso(localDate, newTime, timezone);
      onChange({ ...boss, deadline: iso });
    }
  };

  const handleAddStep = () => {
    if (boss.steps.length >= 6) return;
    const newStep: Step = {
      id: `step_${Date.now()}_${boss.steps.length + 1}`,
      label: '',
      due: localDate || new Date().toISOString().slice(0, 10),
    };
    onChange({ ...boss, steps: [...boss.steps, newStep] });
  };

  const handleUpdateStep = (stepIdx: number, updated: Step) => {
    const nextSteps = [...boss.steps];
    nextSteps[stepIdx] = updated;
    onChange({ ...boss, steps: nextSteps });
  };

  const handleRemoveStep = (stepIdx: number) => {
    const nextSteps = boss.steps.filter((_, i) => i !== stepIdx);
    onChange({ ...boss, steps: nextSteps });
  };

  const handleMoveStep = (stepIdx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? stepIdx - 1 : stepIdx + 1;
    if (targetIdx < 0 || targetIdx >= boss.steps.length) return;
    const nextSteps = [...boss.steps];
    const temp = nextSteps[stepIdx]!;
    nextSteps[stepIdx] = nextSteps[targetIdx]!;
    nextSteps[targetIdx] = temp;
    onChange({ ...boss, steps: nextSteps });
  };

  const handleApplyBackplan = () => {
    if (!boss.deadline) return;
    const dates = proposeStepDates(boss.deadline, backplanCount);
    const newSteps: Step[] = dates.map((due, i) => {
      const existing = boss.steps[i];
      return {
        id: existing?.id ?? `step_${Date.now()}_${i + 1}`,
        label: existing?.label && existing.label.trim() ? existing.label : `Step ${i + 1}`,
        due,
      };
    });
    onChange({ ...boss, steps: newSteps });
    setShowBackplan(false);
  };

  return (
    <article
      style={{
        border: '1px solid #aaa',
        borderRadius: '4px',
        padding: '0.75rem',
        marginBottom: '1rem',
        backgroundColor: '#fff',
      }}
    >
      {/* Header with Title and Reorder/Delete */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          borderBottom: '1px solid #eee',
          paddingBottom: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>
            #{index + 1} [{boss.short || '???'}]
          </span>
          <span style={{ color: '#666', fontSize: '0.9rem' }}>{boss.title || 'Untitled'}</span>
        </div>

        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            title="Move boss up"
            style={{ fontFamily: 'inherit', padding: '0.2rem 0.5rem' }}
          >
            ↑ Up
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="Move boss down"
            style={{ fontFamily: 'inherit', padding: '0.2rem 0.5rem' }}
          >
            ↓ Down
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="Remove boss"
            style={{ fontFamily: 'inherit', padding: '0.2rem 0.5rem', color: '#c00' }}
          >
            Remove Boss
          </button>
        </div>
      </div>

      {/* Main Details Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
            Title:
          </label>
          <input
            type="text"
            value={boss.title}
            placeholder="e.g. Countdown Lock Screen"
            onInput={(e) => onChange({ ...boss, title: (e.target as HTMLInputElement).value })}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              padding: '0.3rem',
              borderColor: titleIssues.length ? '#d00' : '#ccc',
            }}
          />
          {titleIssues.map((msg, i) => (
            <div key={i} style={{ color: '#d00', fontSize: '0.75rem' }}>
              {msg}
            </div>
          ))}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
            Short name ({[...boss.short].length}/5):
          </label>
          <input
            type="text"
            value={boss.short}
            maxLength={5}
            placeholder="LOCK"
            onInput={(e) => onChange({ ...boss, short: (e.target as HTMLInputElement).value.toUpperCase() })}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              padding: '0.3rem',
              borderColor: shortIssues.length ? '#d00' : '#ccc',
            }}
          />
          {shortIssues.map((msg, i) => (
            <div key={i} style={{ color: '#d00', fontSize: '0.75rem' }}>
              {msg}
            </div>
          ))}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
            Subject:
          </label>
          <input
            type="text"
            value={boss.subject}
            placeholder="e.g. design"
            onInput={(e) => onChange({ ...boss, subject: (e.target as HTMLInputElement).value })}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              padding: '0.3rem',
              borderColor: subjectIssues.length ? '#d00' : '#ccc',
            }}
          />
          {subjectIssues.map((msg, i) => (
            <div key={i} style={{ color: '#d00', fontSize: '0.75rem' }}>
              {msg}
            </div>
          ))}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
            Sprite prefix:
          </label>
          <input
            type="text"
            value={boss.sprite}
            placeholder={`boss_${boss.id}`}
            onInput={(e) => onChange({ ...boss, sprite: (e.target as HTMLInputElement).value })}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              padding: '0.3rem',
              borderColor: spriteIssues.length ? '#d00' : '#ccc',
            }}
          />
          {spriteIssues.map((msg, i) => (
            <div key={i} style={{ color: '#d00', fontSize: '0.75rem' }}>
              {msg}
            </div>
          ))}
        </div>
      </div>

      {/* Deadline section */}
      <div
        style={{
          marginTop: '0.75rem',
          padding: '0.5rem',
          backgroundColor: '#f7f7f7',
          borderRadius: '3px',
          border: '1px solid #e0e0e0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={hasDeadline}
              onChange={(e) => handleDeadlineToggle((e.target as HTMLInputElement).checked)}
            />
            <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Set deadline</span>
          </label>

          {hasDeadline ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="date"
                value={localDate}
                onInput={(e) => handleDateChange((e.target as HTMLInputElement).value)}
                style={{ fontFamily: 'inherit', padding: '0.2rem' }}
              />
              <input
                type="time"
                value={localTime}
                onInput={(e) => handleTimeChange((e.target as HTMLInputElement).value)}
                style={{ fontFamily: 'inherit', padding: '0.2rem' }}
              />
              <span style={{ fontSize: '0.8rem', color: '#555' }}>({boss.deadline})</span>
            </div>
          ) : (
            <span style={{ fontSize: '0.8rem', color: '#888' }}>
              (Not set yet — hidden from renderer until a date is chosen)
            </span>
          )}
        </div>
        {deadlineIssues.map((msg, i) => (
          <div key={i} style={{ color: '#d00', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {msg}
          </div>
        ))}
      </div>

      {/* Steps section */}
      <div style={{ marginTop: '0.75rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.4rem',
            flexWrap: 'wrap',
            gap: '0.25rem',
          }}
        >
          <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
            Steps ({boss.steps.length}/6)
          </span>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {hasDeadline && (
              <button
                type="button"
                onClick={() => setShowBackplan(!showBackplan)}
                style={{ fontFamily: 'inherit', fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
              >
                {showBackplan ? 'Hide back-planner' : 'Back-plan steps…'}
              </button>
            )}
            <button
              type="button"
              onClick={handleAddStep}
              disabled={boss.steps.length >= 6}
              style={{ fontFamily: 'inherit', fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
            >
              + Add Step
            </button>
          </div>
        </div>

        {/* Back-planning helper fold */}
        {showBackplan && (
          <div
            style={{
              padding: '0.5rem',
              marginBottom: '0.75rem',
              backgroundColor: '#eef6ff',
              border: '1px solid #bcd',
              borderRadius: '3px',
              fontSize: '0.85rem',
            }}
          >
            <p style={{ margin: '0 0 0.3rem 0' }}>
              <strong>Back-planning helper:</strong> Automatically spaces steps backward from{' '}
              {localDate} back to today, landing the last step one day before the deadline.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label>
                Step count:{' '}
                <select
                  value={backplanCount}
                  onChange={(e) => setBackplanCount(Number((e.target as HTMLSelectElement).value))}
                  style={{ fontFamily: 'inherit' }}
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'step' : 'steps'}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleApplyBackplan}
                style={{ fontFamily: 'inherit', fontWeight: 'bold', padding: '0.2rem 0.6rem' }}
              >
                Apply back-planning
              </button>
              <button
                type="button"
                onClick={() => setShowBackplan(false)}
                style={{ fontFamily: 'inherit', padding: '0.2rem 0.4rem' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {stepsIssues.map((msg, i) => (
          <div key={i} style={{ color: '#d00', fontSize: '0.75rem', marginBottom: '0.4rem' }}>
            {msg}
          </div>
        ))}

        {boss.steps.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: '#777', fontStyle: 'italic', padding: '0.25rem 0' }}>
            No prep steps yet. Add up to 6 steps or use back-planning.
          </div>
        ) : (
          boss.steps.map((step, stepIdx) => (
            <StepItem
              key={step.id}
              step={step}
              index={stepIdx}
              total={boss.steps.length}
              bossIndex={index}
              issueMap={issueMap}
              onChange={(updated) => handleUpdateStep(stepIdx, updated)}
              onRemove={() => handleRemoveStep(stepIdx)}
              onMoveUp={() => handleMoveStep(stepIdx, 'up')}
              onMoveDown={() => handleMoveStep(stepIdx, 'down')}
            />
          ))
        )}
      </div>
    </article>
  );
}
