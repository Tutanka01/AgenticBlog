const NODE_ORDER = ['scraper', 'filter', 'selector', 'fetcher', 'writer', 'critic', 'formatter', 'saver'];

export default function ProgressBar({ nodeStates, elapsedSeconds = 0 }) {
  const doneCount = NODE_ORDER.filter((n) => nodeStates.get(n)?.status === 'done').length;
  const percent = Math.min(100, (doneCount / NODE_ORDER.length) * 100);

  return (
    <div className="mt-2 flex items-center gap-3">
      <div
        className="h-[2px] flex-1 overflow-hidden rounded"
        style={{ backgroundColor: 'var(--bg-border)' }}
      >
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%`, backgroundColor: 'var(--accent-purple)' }}
        />
      </div>
      <p className="mono text-[10px]" style={{ color: 'var(--text-secondary)' }}>
        nœud {doneCount}/8 · {Math.round(elapsedSeconds)}s
      </p>
    </div>
  );
}
