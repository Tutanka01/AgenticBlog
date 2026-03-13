import ThemeToggle from '../ui/ThemeToggle';

const TABS = [
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'outputs', label: 'Outputs' },
  { key: 'history', label: 'History' },
];

export default function Topbar({
  activeView,
  onViewChange,
  theme,
  onToggleTheme,
  runBadge,
  tokenBadge,
  durationBadge,
  hasError,
}) {
  return (
    <div
      className="flex h-11 items-center justify-between border-b px-4"
      style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-base)' }}
    >
      <div className="flex h-full items-end gap-4">
        {TABS.map((tab) => {
          const active = tab.key === activeView;
          return (
            <button
              key={tab.key}
              onClick={() => onViewChange(tab.key)}
              className="relative h-full pb-2 text-sm transition duration-150 ease-out"
              style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              {tab.label}
              <span
                className="absolute bottom-0 left-0 h-[1.5px] w-full"
                style={{
                  backgroundColor: active ? 'var(--accent-purple)' : 'transparent',
                }}
              />
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <span
          className="mono rounded-md border px-2 py-1 text-[11px]"
          style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-elevated)' }}
        >
          {runBadge}
        </span>
        <span
          className="mono rounded-md border px-2 py-1 text-[11px]"
          style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-elevated)' }}
        >
          {tokenBadge}
        </span>
        <span
          className="mono rounded-md border px-2 py-1 text-[11px]"
          style={{
            borderColor: hasError ? 'var(--accent-red)' : 'var(--accent-green)',
            backgroundColor: 'var(--bg-elevated)',
            color: hasError ? 'var(--accent-red)' : 'var(--accent-green)',
          }}
        >
          {durationBadge}
        </span>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </div>
  );
}
