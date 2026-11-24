import type { Plan } from '@boss-rush/core';
import { useState } from 'preact/hooks';
import { formatRemindersList } from './io';

interface RemindersSectionProps {
  plan: Plan;
}

export function RemindersSection({ plan }: RemindersSectionProps) {
  const [copied, setCopied] = useState(false);
  const text = formatRemindersList(plan);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed (e.g. no focus)
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <section
      style={{
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '0.75rem',
        marginBottom: '1rem',
        backgroundColor: '#fbfbfb',
      }}
    >
      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem' }}>
          Printable Apple Reminders List (fallback for manual entry)
        </summary>

        <div style={{ marginTop: '0.5rem' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#555' }}>
            A plain printable checklist of all steps with dates, grouped by deadline, for typing
            into Apple Reminders by hand if Shortcuts automation is unavailable.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <button
              type="button"
              onClick={handleCopy}
              style={{ fontFamily: 'inherit', padding: '0.3rem 0.6rem' }}
            >
              {copied ? '✓ Copied to clipboard!' : 'Copy checklist'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              style={{ fontFamily: 'inherit', padding: '0.3rem 0.6rem' }}
            >
              Print list
            </button>
          </div>

          <pre
            style={{
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              padding: '0.75rem',
              borderRadius: '3px',
              fontSize: '0.8rem',
              whiteSpace: 'pre-wrap',
              maxHeight: '300px',
              overflowY: 'auto',
            }}
          >
            {text}
          </pre>
        </div>
      </details>
    </section>
  );
}
