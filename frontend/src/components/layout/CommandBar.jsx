import { Activity, Clock3, FolderOutput, Play, Square } from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';

const TABS = [
  { key: 'pipeline', label: 'Pipeline', icon: Activity },
  { key: 'outputs',  label: 'Outputs',  icon: FolderOutput },
  { key: 'history',  label: 'History',  icon: Clock3 },
];

const CATEGORIES = [
  { id: 'infra',    label: 'infra',    color: '#22C55E' },
  { id: 'security', label: 'security', color: '#EF4444' },
  { id: 'ai',       label: 'ai',       color: '#8B5CF6' },
  { id: 'cloud',    label: 'cloud',    color: '#3B82F6' },
  { id: 'africa',   label: 'africa',   color: '#F59E0B' },
];

const LANGUAGES = [
  { id: 'fr', label: 'fr' },
  { id: 'en', label: 'en' },
  { id: 'ar', label: 'ar' },
];

export default function CommandBar({
  activeView,
  onViewChange,
  category,
  onCategoryChange,
  lang,
  onLangChange,
  isRunning,
  onRunToggle,
  topbarData,
  hasError,
  theme,
  onToggleTheme,
}) {
  const catColor = CATEGORIES.find((c) => c.id === category)?.color || '#8B5CF6';
  const durationColor = hasError ? '#EF4444' : '#22C55E';

  return (
    <header
      style={{
        height: 'var(--topbar-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid var(--bg-border)',
        backgroundColor: 'var(--bg-surface)',
        backdropFilter: 'blur(8px)',
        position: 'relative',
        zIndex: 20,
        flexShrink: 0,
        gap: 8,
      }}
    >
      {/* Left: Logo */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            background: 'var(--brand-gradient)',
            flexShrink: 0,
          }}
        />
        <div className="flex items-baseline gap-1.5">
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--text-primary)', lineHeight: 1 }}>
            AgenticBlog
          </span>
          <span
            style={{
              fontSize: 9,
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
            }}
          >
            LangGraph
          </span>
        </div>
      </div>

      {/* Center: Nav tabs */}
      <nav className="flex items-center gap-1" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        {TABS.map(({ key, label }) => {
          const active = activeView === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onViewChange(key)}
              style={{
                position: 'relative',
                padding: '4px 12px',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 6,
                transition: 'color 150ms',
              }}
            >
              {label}
              {active && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: -1,
                    left: 12,
                    right: 12,
                    height: 2,
                    borderRadius: '2px 2px 0 0',
                    backgroundColor: 'var(--accent-purple)',
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Right: Controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Category selector */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span
            style={{
              position: 'absolute',
              left: 8,
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: catColor,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            style={{
              appearance: 'none',
              paddingLeft: 22,
              paddingRight: 20,
              paddingTop: 4,
              paddingBottom: 4,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              borderRadius: 6,
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
          <span
            style={{
              position: 'absolute',
              right: 6,
              fontSize: 9,
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          >
            ▾
          </span>
        </div>

        {/* Language selector */}
        <select
          value={lang}
          onChange={(e) => onLangChange(e.target.value)}
          style={{
            appearance: 'none',
            padding: '4px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--bg-border)',
            borderRadius: 6,
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>

        {/* Run/Stop button */}
        <button
          type="button"
          onClick={onRunToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 28,
            padding: '0 12px',
            borderRadius: 14,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: isRunning ? '#dc2626' : 'var(--accent-purple)',
            transition: 'background-color 150ms',
            animation: isRunning ? 'runPulse 1.5s ease-in-out infinite' : 'none',
          }}
        >
          {isRunning ? <Square size={11} /> : <Play size={11} />}
          {isRunning ? 'Stop' : 'Run'}
        </button>

        {/* Stat badges */}
        {topbarData?.runBadge && (
          <span
            className="mono"
            style={{ fontSize: 10, color: 'var(--text-muted)', userSelect: 'none' }}
          >
            {topbarData.runBadge}
          </span>
        )}
        {topbarData?.tokenBadge && (
          <span
            className="mono"
            style={{ fontSize: 10, color: 'var(--text-muted)', userSelect: 'none' }}
          >
            {topbarData.tokenBadge}
          </span>
        )}
        {topbarData?.duration && topbarData.duration !== '0s' && (
          <span
            className="mono"
            style={{ fontSize: 10, color: durationColor, userSelect: 'none' }}
          >
            {topbarData.duration}
          </span>
        )}

        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
