import { ChevronDown, Terminal, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { nodeColor } from '../../lib/pipeline';

export default function LogConsole({ logs, onClear }) {
  const [open, setOpen] = useState(true);
  const scrollRef = useRef(null);

  // Only human-readable lines — structured `data` events render in the panels.
  const lines = useMemo(() => logs.filter((l) => !l?.data && l?.message), [logs]);

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines, open]);

  return (
    <div style={{ borderTop: '1px solid var(--bg-border)', background: 'var(--bg-surface)', flexShrink: 0 }}>
      <div className="flex items-center gap-2 px-4" style={{ height: 38 }}>
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <Terminal size={13} />
          <span className="panel-title" style={{ color: 'var(--text-muted)' }}>Console</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>{lines.length}</span>
          <ChevronDown size={13} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 150ms' }} />
        </button>
        <div className="ml-auto">
          <button type="button" onClick={onClear} className="btn btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: 11 }}>
            <Trash2 size={11} /> Clear
          </button>
        </div>
      </div>

      {open && (
        <div ref={scrollRef} className="custom-scrollbar mono" style={{ maxHeight: 168, overflowY: 'auto', padding: '4px 16px 12px', fontSize: 11.5, lineHeight: 1.7 }}>
          {lines.length === 0 ? (
            <p style={{ color: 'var(--text-faint)' }}>Waiting for the pipeline…</p>
          ) : (
            lines.map((l, i) => {
              const isSystem = l.node === 'system';
              const color = l.status === 'error' ? 'var(--accent-red)' : isSystem ? 'var(--text-faint)' : nodeColor(l.node);
              return (
                <div key={i} className="flex gap-2.5" style={{ color: l.status === 'error' ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--text-faint)', flexShrink: 0 }}>{new Date(l.ts).toLocaleTimeString()}</span>
                  <span style={{ color, flexShrink: 0, width: 66, fontWeight: 600 }}>{l.node}</span>
                  <span style={{ wordBreak: 'break-word' }}>{l.message}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
