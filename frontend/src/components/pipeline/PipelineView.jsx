import { useMemo, useState } from 'react';
import LogConsole from './LogConsole';
import NodeDrawer from './NodeDrawer';
import NodeGraph from './NodeGraph';
import ProgressBar from './ProgressBar';

function subtitleFor(node, state) {
  if (!state) return 'idle';

  const { status, message = '', meta = {} } = state;
  if (status === 'idle') return 'waiting';
  if (status === 'running') return message;
  if (status === 'error') return message || 'error';

  if (node === 'scraper') return meta.count ? `${meta.count} articles` : message;
  if (node === 'filter') return meta.kept ? `${meta.kept} kept` : message;
  if (node === 'selector') {
    const score = meta.score || (meta.floats && meta.floats[0]);
    return score ? `score ${score} · article sélectionné` : message;
  }
  if (node === 'fetcher') {
    const method = meta.method || 'direct';
    return `${method} · ${meta.chars || 0} chars`;
  }
  if (node === 'writer') return `iter ${meta.iteration || '?'} / 3 · ${meta.words || 0}w`;
  if (node === 'critic') return `${meta.score || '?'} / 10 · ${meta.approved ? 'approved' : 'rejected'}`;
  if (node === 'formatter') return '3 outputs';
  if (node === 'saver') return meta.run_id ? `run_id: ${meta.run_id}` : message;
  return message;
}

export default function PipelineView({ nodeStates, logs, elapsedSeconds, onClearLogs }) {
  const [drawerNode, setDrawerNode] = useState('');

  const subtitles = useMemo(() => {
    const names = ['scraper', 'filter', 'selector', 'fetcher', 'critic', 'writer', 'formatter', 'saver'];
    return names.reduce((acc, node) => {
      acc[node] = subtitleFor(node, nodeStates.get(node));
      return acc;
    }, {});
  }, [nodeStates]);

  const nodeState = drawerNode ? nodeStates.get(drawerNode) : null;

  return (
    <div className="flex h-full flex-col px-4 py-4">
      <div className="card flex-1 p-5">
        <NodeGraph
          nodeStates={nodeStates}
          subtitles={subtitles}
          onNodeClick={(node) => {
            if (nodeStates.get(node)?.status === 'done') {
              setDrawerNode(node);
            }
          }}
        />
      </div>

      <ProgressBar nodeStates={nodeStates} elapsedSeconds={elapsedSeconds} />
      <LogConsole logs={logs} onClear={onClearLogs} />

      <NodeDrawer open={Boolean(drawerNode)} node={drawerNode} state={nodeState} onClose={() => setDrawerNode('')} />
    </div>
  );
}
