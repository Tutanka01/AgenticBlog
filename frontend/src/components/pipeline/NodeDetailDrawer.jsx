import { AlertTriangle, Users, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';

const STATUS_STYLE = {
  idle:    { label: 'idle',    color: '#71717A', bg: 'var(--bg-elevated)' },
  running: { label: 'running', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  done:    { label: 'done',    color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  error:   { label: 'error',   color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

const NODE_ACCENT = {
  scraper:   '#22C55E',
  filter:    '#22C55E',
  selector:  '#22C55E',
  fetcher:   '#22C55E',
  writer:    '#8B5CF6',
  critic:    '#8B5CF6',
  formatter: '#3B82F6',
  saver:     '#3B82F6',
};

function colorizeJsonLine(line, key) {
  const keyMatch = line.match(/^(\s*)"([^"]+)":\s*(.*?)(,?)$/);

  if (!keyMatch) {
    return (
      <div key={key}>
        <span style={{ color: 'var(--text-muted)' }}>{line || ' '}</span>
      </div>
    );
  }

  const [, indent, field, rawValue, comma] = keyMatch;
  const value = rawValue.trim();

  let valueColor = 'var(--text-secondary)';
  if (/^".*"$/.test(value)) valueColor = '#86EFAC';
  else if (/^-?\d+(\.\d+)?$/.test(value)) valueColor = '#F59E0B';
  else if (/^(true|false|null)$/.test(value)) valueColor = '#FCA5A5';

  return (
    <div key={key}>
      <span style={{ color: 'var(--text-muted)' }}>{indent}</span>
      <span style={{ color: '#8B5CF6' }}>&quot;{field}&quot;</span>
      <span style={{ color: 'var(--text-secondary)' }}>: </span>
      <span style={{ color: valueColor }}>{value}</span>
      {comma ? <span style={{ color: 'var(--text-secondary)' }}>{comma}</span> : null}
    </div>
  );
}

export default function NodeDetailDrawer({ open, node, state, logs, onClose }) {
  useEffect(() => {
    const onEscape = () => onClose();
    window.addEventListener('agenticblog:escape', onEscape);
    return () => window.removeEventListener('agenticblog:escape', onEscape);
  }, [onClose]);

  const nodeLogs = useMemo(() => {
    if (!node) return [];
    return logs.filter((entry) => entry?.node === node).slice(-10);
  }, [logs, node]);

  if (!open || !node) return null;

  const status = state?.status || 'idle';
  const badge = STATUS_STYLE[status] || STATUS_STYLE.idle;
  const payload = JSON.stringify(state?.meta || {}, null, 2);
  const accentColor = NODE_ACCENT[node] || '#8B5CF6';

  const firstLog = logs.find((l) => l?.node === node);
  const lastLog = [...logs].reverse().find((l) => l?.node === node);
  const startedAt = firstLog ? new Date(firstLog.ts).toLocaleTimeString() : null;
  const endedAt = lastLog && status === 'done' ? new Date(lastLog.ts).toLocaleTimeString() : null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-30"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
        aria-label="Close node details"
      />

      <aside
        className="fixed right-0 top-0 z-40 h-full border-l overflow-y-auto custom-scrollbar"
        style={{
          width: 420,
          borderColor: 'var(--bg-border)',
          backgroundColor: 'var(--bg-surface)',
          animation: 'slideInRight 0.2s ease-out',
          borderTop: `3px solid ${accentColor}`,
        }}
      >
        <div className="p-4">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--text-primary)' }}>
                {node}
              </p>
              <span
                className="mt-1 inline-flex rounded px-2 py-0.5 text-[10px] uppercase tracking-[0.04em]"
                style={{ color: badge.color, backgroundColor: badge.bg }}
              >
                {badge.label}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded border p-1"
              style={{ borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Debate Panel — only for the multi-critic node */}
          {node === 'critic' && (
            <section
              className="mb-4 rounded-md border p-3"
              style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-elevated)' }}
            >
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>
                Debate Panel
              </p>

              {/* Security flag banner */}
              {state?.meta?.security_flag && (
                <div
                  className="mb-3 flex items-center gap-2 rounded-md border px-3 py-2 text-[11px]"
                  style={{ borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.07)', color: '#FCA5A5' }}
                >
                  <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>Security flag</span>
                  <span style={{ color: 'var(--text-secondary)' }}>— dangerous snippet detected</span>
                </div>
              )}

              {/* Personas */}
              {state?.meta?.personas?.length > 0 && (
                <div className="mb-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Users size={10} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Personas</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {state.meta.personas.map((name, i) => (
                      <span
                        key={i}
                        className="rounded px-2 py-0.5 text-[11px]"
                        style={{ backgroundColor: 'rgba(139,92,246,0.12)', color: '#C4B5FD' }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Debate config row */}
              <div className="flex flex-wrap gap-4 mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {state?.meta?.debate_rounds != null && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>rounds </span>
                    <span>{state.meta.debate_rounds}</span>
                  </div>
                )}
                {state?.meta?.num_personas != null && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>personas </span>
                    <span>{state.meta.num_personas}</span>
                  </div>
                )}
                {state?.meta?.stagnation_count > 0 && (
                  <div>
                    <span style={{ color: '#F59E0B' }}>stagnation×{state.meta.stagnation_count}</span>
                  </div>
                )}
                {state?.meta?.score != null && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>score </span>
                    <span style={{ color: state.meta.score >= 7 ? '#22C55E' : state.meta.score >= 5 ? '#F59E0B' : '#EF4444' }}>
                      {state.meta.score}/10
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Timeline */}
          {startedAt && (
            <section className="mb-4 rounded-md border p-3" style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-elevated)' }}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>
                Timeline
              </p>
              <div className="space-y-1 mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>started</span>
                  <span>{startedAt}</span>
                </div>
                {endedAt && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>completed</span>
                    <span style={{ color: '#22C55E' }}>{endedAt}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Payload */}
          <section className="mb-4 rounded-md border p-3" style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--surface-code)' }}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>
              Payload
            </p>
            <div className="mono text-[11px] leading-6">
              {payload.split('\n').map((line, idx) => colorizeJsonLine(line, `json-${idx}`))}
            </div>
          </section>

          {/* Associated logs */}
          <section className="rounded-md border p-3" style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--surface-code)' }}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>
              Logs ({nodeLogs.length})
            </p>

            <div className="space-y-1.5">
              {nodeLogs.length === 0 ? (
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  No logs for this node.
                </p>
              ) : (
                nodeLogs.map((log, idx) => (
                  <div key={`log-${idx}`} className="flex items-start gap-2 text-[11px]">
                    <span className="mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      [{new Date(log.ts).toLocaleTimeString()}]
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
