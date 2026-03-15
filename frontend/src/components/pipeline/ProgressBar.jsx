const NODE_ORDER = ['scraper', 'filter', 'selector', 'fetcher', 'writer', 'critic', 'formatter', 'saver'];

const segmentColor = (status) => {
  if (status === 'done')    return '#22C55E';
  if (status === 'running') return '#8B5CF6';
  if (status === 'error')   return '#EF4444';
  return '#1E1E22';
};

export default function ProgressBar({ nodeStates, elapsedSeconds = 0 }) {
  const doneCount = NODE_ORDER.filter((n) => nodeStates.get(n)?.status === 'done').length;

  return (
    <div className="flex items-center gap-2 px-0" style={{ flexShrink: 0 }}>
      {/* 8-segment bar: one segment per pipeline node */}
      <div className="flex flex-1 h-[3px] gap-px">
        {NODE_ORDER.map((node) => {
          const status = nodeStates.get(node)?.status || 'idle';
          return (
            <div
              key={node}
              className="flex-1"
              style={{
                backgroundColor: segmentColor(status),
                transition: 'background-color 500ms ease',
              }}
            />
          );
        })}
      </div>

      <span
        className="mono flex-shrink-0 pr-3"
        style={{ fontSize: 10, color: 'var(--text-secondary)', userSelect: 'none' }}
      >
        {doneCount}/8 · {Math.round(elapsedSeconds)}s
      </span>
    </div>
  );
}
