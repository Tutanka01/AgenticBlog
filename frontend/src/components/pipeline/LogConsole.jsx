import { memo, useEffect, useRef, useState } from 'react';

const BADGE_STYLE = {
  scraper: { bg: 'rgba(34,197,94,0.1)', color: '#86efac' },
  filter: { bg: 'rgba(34,197,94,0.1)', color: '#86efac' },
  selector: { bg: 'rgba(34,197,94,0.1)', color: '#86efac' },
  fetcher: { bg: 'rgba(34,197,94,0.1)', color: '#86efac' },
  writer: { bg: 'rgba(139,92,246,0.1)', color: '#c4b5fd' },
  critic: { bg: 'rgba(139,92,246,0.1)', color: '#c4b5fd' },
  formatter: { bg: 'rgba(59,130,246,0.1)', color: '#93c5fd' },
  saver: { bg: 'rgba(59,130,246,0.1)', color: '#93c5fd' },
  error: { bg: 'rgba(239,68,68,0.1)', color: '#fca5a5' },
  system: { bg: 'rgba(139,92,246,0.1)', color: '#c4b5fd' },
};

function buildLine(log) {
  const row = document.createElement('div');
  row.className = 'mb-1 flex items-center gap-2 text-[11px]';

  const ts = document.createElement('span');
  ts.className = 'mono';
  ts.style.color = 'var(--text-muted)';
  ts.textContent = `[${new Date(log.ts).toLocaleTimeString()}]`;

  const badge = document.createElement('span');
  badge.className = 'rounded px-1.5 py-0.5 mono text-[10px]';
  const style = BADGE_STYLE[log.status === 'error' ? 'error' : log.node] || BADGE_STYLE.system;
  badge.style.backgroundColor = style.bg;
  badge.style.color = style.color;
  badge.textContent = log.node;

  const message = document.createElement('span');
  message.style.color = 'var(--text-secondary)';
  message.textContent = log.message;

  row.appendChild(ts);
  row.appendChild(badge);
  row.appendChild(message);

  return row;
}

function LogConsole({ logs, onClear }) {
  const listRef = useRef(null);
  const renderedCountRef = useRef(0);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      setAutoScroll(nearBottom);
    };

    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    for (let i = renderedCountRef.current; i < logs.length; i += 1) {
      container.appendChild(buildLine(logs[i]));
    }

    renderedCountRef.current = logs.length;

    while (container.childElementCount > 500) {
      container.removeChild(container.firstChild);
    }

    if (autoScroll) {
      container.scrollTop = container.scrollHeight;
    }
  }, [logs, autoScroll]);

  const clear = () => {
    if (listRef.current) {
      listRef.current.innerHTML = '';
    }
    renderedCountRef.current = 0;
    onClear();
  };

  return (
    <div
      className="mt-2 h-[180px] border-t px-4 py-3"
      style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-base)' }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="live-dot h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--accent-green)' }} />
          <span className="label">Live Logs</span>
          {!autoScroll && (
            <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ color: 'var(--accent-purple)' }}>
              ↓ New logs
            </span>
          )}
        </div>
        <button className="text-xs" style={{ color: 'var(--text-secondary)' }} onClick={clear}>
          Clear
        </button>
      </div>
      <div ref={listRef} className="h-[138px] overflow-auto" />
    </div>
  );
}

export default memo(LogConsole);
