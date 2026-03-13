import { AlertCircle, Loader2 } from 'lucide-react';
import { forwardRef } from 'react';

const STATE_STYLE = {
  idle: {
    bg: 'var(--bg-elevated)',
    border: 'var(--bg-border)',
    dot: 'var(--text-muted)',
  },
  running: {
    bg: 'var(--bg-elevated)',
    border: 'var(--accent-purple-border)',
    dot: 'var(--accent-purple)',
  },
  done: {
    bg: 'var(--accent-green-dim)',
    border: 'rgba(34,197,94,0.3)',
    dot: 'var(--accent-green)',
  },
  error: {
    bg: 'rgba(239,68,68,0.05)',
    border: 'rgba(239,68,68,0.3)',
    dot: 'var(--accent-red)',
  },
};

const NodeCard = forwardRef(function NodeCard({ node, state, subtitle, onClick }, ref) {
  const status = state?.status || 'idle';
  const style = STATE_STYLE[status] || STATE_STYLE.idle;

  return (
    <button
      ref={ref}
      onClick={onClick}
      className="min-w-[100px] rounded-lg border px-3 py-2 text-left transition duration-150 ease-out"
      style={{
        backgroundColor: style.bg,
        borderColor: style.border,
        boxShadow: status === 'running' ? 'var(--glow-purple)' : 'none',
      }}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase" style={{ color: 'var(--text-primary)' }}>
        <span
          className={`h-[5px] w-[5px] rounded-full ${status === 'running' ? 'live-dot' : ''}`}
          style={{ backgroundColor: style.dot }}
        />
        <span>{node}</span>
        {status === 'running' && <Loader2 size={10} className="animate-spin" />}
        {status === 'error' && <AlertCircle size={10} style={{ color: 'var(--accent-red)' }} />}
      </div>
      <div className="mt-1 text-[9px]" style={{ color: 'var(--text-secondary)' }}>
        {subtitle}
      </div>
    </button>
  );
});

export default NodeCard;
