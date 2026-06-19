import { Coins, Hash, Square, Timer } from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';

const VIEW_META = {
  compose: { title: 'Compose a run', subtitle: 'Pick a source and language, then launch the pipeline' },
  live: { title: 'Live run', subtitle: 'Curation, debate and authoring as they happen' },
  review: { title: 'Review', subtitle: 'The four outputs and their provenance' },
  history: { title: 'History', subtitle: 'Every past run' },
  memory: { title: 'Editorial memory', subtitle: 'What the pipeline remembers across runs' },
  settings: { title: 'Settings', subtitle: 'Categories, feeds and pipeline thresholds' },
};

function Stat({ icon: Icon, value, color }) {
  return (
    <span className="chip mono" style={{ color: color || 'var(--text-secondary)' }}>
      <Icon size={11} style={{ opacity: 0.7 }} />
      {value}
    </span>
  );
}

export default function Topbar({ activeView, isRunning, onStop, topbar, hasError, theme, onToggleTheme }) {
  const meta = VIEW_META[activeView] || VIEW_META.compose;
  const durationColor = hasError ? 'var(--accent-red)' : isRunning ? 'var(--accent-purple)' : 'var(--text-secondary)';

  return (
    <header
      className="flex items-center justify-between gap-4 px-6"
      style={{
        height: 'var(--topbar-height)',
        flexShrink: 0,
        borderBottom: '1px solid var(--bg-border)',
        background: 'var(--bg-surface)',
      }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
            {meta.title}
          </h1>
          {isRunning && (
            <span className="chip" style={{ borderColor: 'var(--accent-purple-border)', color: 'var(--accent-purple-soft)', background: 'var(--accent-purple-dim)' }}>
              <span className="dot status-dot-pulse" style={{ background: 'var(--accent-purple)' }} />
              running
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }} className="truncate">{meta.subtitle}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {topbar?.runId && topbar.runId !== '—' && <Stat icon={Hash} value={topbar.runId} />}
        {topbar?.tokens > 0 && <Stat icon={Coins} value={`${topbar.tokens.toLocaleString()} tok`} />}
        {topbar?.duration && topbar.duration !== '0s' && <Stat icon={Timer} value={topbar.duration} color={durationColor} />}

        {isRunning && (
          <button type="button" className="btn btn-danger" style={{ height: 32 }} onClick={onStop}>
            <Square size={12} /> Stop
          </button>
        )}

        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
