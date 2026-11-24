// App shell. SHARED FILE: integrator-only. Each tab is owned by one brief, which edits only
// its own folder and keeps the default export of its index.tsx.
import { useState } from 'preact/hooks';
import { ArtBench } from './artbench';
import { Export } from './export';
import { Planner } from './planner';
import { Preview } from './preview';

const tabs = [
  { id: 'preview', label: 'Preview', view: Preview },
  { id: 'planner', label: 'Planner', view: Planner },
  { id: 'export', label: 'Export', view: Export },
  { id: 'artbench', label: 'Art bench', view: ArtBench },
] as const;

type TabId = (typeof tabs)[number]['id'];

export function App() {
  const [active, setActive] = useState<TabId>('preview');
  const View = tabs.find((t) => t.id === active)!.view;
  return (
    <main style={{ fontFamily: 'monospace', padding: '1rem' }}>
      <header style={{ display: 'flex', gap: '1rem', alignItems: 'baseline' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Boss Rush</h1>
        <nav style={{ display: 'flex', gap: '0.5rem' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              aria-pressed={t.id === active}
              style={{ fontFamily: 'inherit', fontWeight: t.id === active ? 'bold' : 'normal' }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <View />
    </main>
  );
}
