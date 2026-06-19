import { Brain, FileCheck2, History, PenLine, Radio, SlidersHorizontal } from 'lucide-react';

const GROUPS = [
  {
    title: 'Run lifecycle',
    items: [
      { key: 'compose', label: 'Compose', icon: PenLine, step: '1' },
      { key: 'live', label: 'Live run', icon: Radio, step: '2' },
      { key: 'review', label: 'Review', icon: FileCheck2, step: '3' },
    ],
  },
  {
    title: 'Library',
    items: [
      { key: 'history', label: 'History', icon: History },
      { key: 'memory', label: 'Memory', icon: Brain },
    ],
  },
  {
    title: 'System',
    items: [{ key: 'settings', label: 'Settings', icon: SlidersHorizontal }],
  },
];

function NavItem({ item, active, isRunning, runCount, onNavigate }) {
  const Icon = item.icon;
  const liveDot = item.key === 'live' && isRunning;
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.key)}
      className="group relative flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors"
      style={{
        background: active ? 'var(--bg-elevated)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
    >
      {active && (
        <span
          className="absolute left-[-10px] top-2 bottom-2 w-[2.5px] rounded-full"
          style={{ background: 'var(--brand-gradient)' }}
        />
      )}
      <Icon size={16} style={{ opacity: active ? 1 : 0.72, flexShrink: 0 }} />
      <span style={{ fontSize: 13.5, fontWeight: active ? 600 : 500 }}>{item.label}</span>

      {item.step && (
        <span className="mono ml-auto" style={{ fontSize: 10, color: active ? 'var(--text-muted)' : 'var(--text-faint)' }}>
          {item.step}
        </span>
      )}
      {liveDot && <span className="dot live-dot ml-auto" style={{ background: 'var(--accent-green)' }} />}
      {item.key === 'history' && runCount > 0 && !active && (
        <span className="mono ml-auto" style={{ fontSize: 10, color: 'var(--text-faint)' }}>{runCount}</span>
      )}
    </button>
  );
}

export default function Sidebar({ activeView, onNavigate, isRunning, runCount }) {
  return (
    <aside
      className="flex h-full flex-col"
      style={{
        width: 'var(--sidebar-width)',
        flexShrink: 0,
        borderRight: '1px solid var(--bg-border)',
        background: 'var(--bg-surface)',
      }}
    >
      <div
        className="flex items-center gap-2.5 px-4"
        style={{ height: 'var(--topbar-height)', borderBottom: '1px solid var(--bg-border)' }}
      >
        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--brand-gradient)', flexShrink: 0 }} />
        <div className="flex flex-col leading-none">
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
            AgenticBlog
          </span>
          <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>
            LangGraph pipeline
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4">
        {GROUPS.map((group) => (
          <div key={group.title} className="mb-5">
            <p className="eyebrow px-2.5" style={{ marginBottom: 8 }}>{group.title}</p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.key}
                  item={item}
                  active={activeView === item.key}
                  isRunning={isRunning}
                  runCount={runCount}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--bg-border)' }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mohamad El Akhal</p>
        <p className="mono" style={{ fontSize: 9.5, color: 'var(--text-faint)', marginTop: 2 }}>makhal.fr · agentic content</p>
      </div>
    </aside>
  );
}
