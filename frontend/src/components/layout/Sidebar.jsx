import { Activity, Clock3, FolderOutput, Github, Play, Square } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'pipeline', label: 'Pipeline', icon: Activity },
  { key: 'outputs', label: 'Outputs', icon: FolderOutput },
  { key: 'history', label: 'History', icon: Clock3 },
];

const CATEGORY_COLORS = {
  security: '#EF4444',
  infra: '#22C55E',
  ai: '#8B5CF6',
  cloud: '#3B82F6',
  africa: '#F59E0B',
};

export default function Sidebar({
  activeView,
  onViewChange,
  category,
  onCategoryChange,
  isRunning,
  onRunToggle,
}) {
  return (
    <aside
      className="flex h-screen w-[220px] flex-col border-r px-3 py-3"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}
    >
      <div className="mb-5 px-1">
        <div className="flex items-center gap-2">
          <div
            className="h-5 w-5 rounded-md"
            style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #22C55E 100%)',
            }}
          />
          <div>
            <p className="text-sm font-bold tracking-[-0.4px]">AgenticBlog</p>
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              LangGraph pipeline
            </p>
          </div>
        </div>
      </div>

      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onViewChange(item.key)}
              className="group relative flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition duration-150 ease-out"
              style={{
                backgroundColor: active ? 'var(--bg-elevated)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              <span
                className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-sm"
                style={{ backgroundColor: active ? 'var(--accent-purple)' : 'transparent' }}
              />
              <Icon size={14} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-6">
        <p className="label mb-2">Category</p>
        <div className="space-y-1">
          {Object.keys(CATEGORY_COLORS).map((cat) => {
            const active = cat === category;
            return (
              <button
                key={cat}
                onClick={() => onCategoryChange(cat)}
                className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition duration-150 ease-out"
                style={{
                  borderColor: active ? 'var(--accent-purple-border)' : 'var(--bg-border)',
                  backgroundColor: active ? 'var(--accent-purple-dim)' : 'transparent',
                  color: active ? 'var(--accent-purple)' : 'var(--text-secondary)',
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                />
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onRunToggle}
        disabled={!isRunning && !category}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          backgroundColor: isRunning ? '#dc2626' : 'var(--accent-purple)',
          color: '#fff',
        }}
      >
        {isRunning ? <Square size={14} /> : <Play size={14} />}
        {isRunning ? 'Stop' : 'Run'}
      </button>

      <div className="mt-auto border-t pt-2 text-[10px]" style={{ borderColor: 'var(--bg-border)' }}>
        <p style={{ color: 'var(--text-muted)' }}>v1.0.0</p>
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1"
          style={{ color: 'var(--text-muted)' }}
        >
          <Github size={10} /> GitHub
        </a>
      </div>
    </aside>
  );
}
