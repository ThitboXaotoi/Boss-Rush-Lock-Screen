import type { Step } from '@boss-rush/core';

interface StepItemProps {
  step: Step;
  index: number;
  total: number;
  bossIndex: number;
  issueMap: Map<string, string[]>;
  onChange: (updated: Step) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function StepItem({
  step,
  index,
  total,
  bossIndex,
  issueMap,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: StepItemProps) {
  const basePath = `bosses[${bossIndex}].steps[${index}]`;
  const labelIssues = issueMap.get(`${basePath}.label`) ?? [];
  const dueIssues = issueMap.get(`${basePath}.due`) ?? [];
  const idIssues = issueMap.get(`${basePath}.id`) ?? [];

  return (
    <div
      style={{
        border: '1px dashed #aaa',
        padding: '0.5rem',
        marginBottom: '0.5rem',
        borderRadius: '3px',
        backgroundColor: '#fafafa',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.25rem',
          flexWrap: 'wrap',
          gap: '0.25rem',
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Step #{index + 1}</span>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            title="Move step up"
            style={{ fontFamily: 'inherit', fontSize: '0.8rem', padding: '0.1rem 0.4rem' }}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="Move step down"
            style={{ fontFamily: 'inherit', fontSize: '0.8rem', padding: '0.1rem 0.4rem' }}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="Delete step"
            style={{ fontFamily: 'inherit', fontSize: '0.8rem', padding: '0.1rem 0.4rem', color: '#a00' }}
          >
            Remove
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 180px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.1rem' }}>
            Label ({[...step.label].length}/14):
          </label>
          <input
            type="text"
            value={step.label}
            maxLength={14}
            placeholder="e.g. Slide outline"
            onInput={(e) => onChange({ ...step, label: (e.target as HTMLInputElement).value })}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              padding: '0.25rem',
              borderColor: labelIssues.length ? '#d00' : '#ccc',
            }}
          />
          {labelIssues.map((msg, i) => (
            <div key={i} style={{ color: '#d00', fontSize: '0.75rem', marginTop: '0.1rem' }}>
              {msg}
            </div>
          ))}
        </div>

        <div style={{ flex: '1 1 130px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.1rem' }}>
            Due date:
          </label>
          <input
            type="date"
            value={step.due}
            onInput={(e) => onChange({ ...step, due: (e.target as HTMLInputElement).value })}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              padding: '0.25rem',
              borderColor: dueIssues.length ? '#d00' : '#ccc',
            }}
          />
          {dueIssues.map((msg, i) => (
            <div key={i} style={{ color: '#d00', fontSize: '0.75rem', marginTop: '0.1rem' }}>
              {msg}
            </div>
          ))}
        </div>
      </div>

      {idIssues.map((msg, i) => (
        <div key={i} style={{ color: '#d00', fontSize: '0.75rem', marginTop: '0.1rem' }}>
          {msg}
        </div>
      ))}
    </div>
  );
}
