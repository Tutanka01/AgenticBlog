import {
  Background, Handle, Position, ReactFlow, useEdgesState, useNodesState,
} from '@xyflow/react';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import '@xyflow/react/dist/style.css';
import { NODES, ORDERED_NODES, STATUS_COLOR, nodeColor } from '../../lib/pipeline';

const POS = {
  scraper: { x: 0, y: 70 }, filter: { x: 175, y: 70 }, selector: { x: 350, y: 70 }, fetcher: { x: 525, y: 70 },
  writer: { x: 700, y: 70 }, critic: { x: 700, y: 220 }, formatter: { x: 525, y: 220 }, saver: { x: 350, y: 220 },
};

function statusOf(nodeStates, id) {
  return nodeStates.get(id)?.status || 'idle';
}

function PipelineNode({ data }) {
  const status = data.status || 'idle';
  const phase = nodeColor(data.id);
  const running = status === 'running';
  const done = status === 'done';
  const err = status === 'error';
  const ring = err ? STATUS_COLOR.error : running ? STATUS_COLOR.running : done ? phase : 'var(--bg-border-strong)';

  return (
    <div
      onClick={() => data.onClick(data.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && data.onClick(data.id)}
      style={{
        width: 150,
        padding: '10px 12px',
        borderRadius: 11,
        background: done ? `color-mix(in srgb, ${phase} 7%, var(--bg-surface))` : running ? 'var(--accent-purple-dim)' : 'var(--bg-surface)',
        border: `1px solid ${ring}`,
        borderTop: `2.5px solid ${done || running ? ring : phase}`,
        boxShadow: running ? 'var(--node-running-glow)' : 'none',
        cursor: 'pointer',
        transition: 'all 280ms ease',
      }}
    >
      <Handle id="l" type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle id="r" type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle id="t" type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle id="b" type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle id="bl" type="source" position={Position.Bottom} style={{ opacity: 0, left: '36%' }} />
      <Handle id="br" type="target" position={Position.Bottom} style={{ opacity: 0, left: '64%' }} />
      <Handle id="tl" type="target" position={Position.Top} style={{ opacity: 0, left: '36%' }} />
      <Handle id="tr" type="source" position={Position.Top} style={{ opacity: 0, left: '64%' }} />

      <div className="flex items-center gap-1.5">
        <span
          className={`dot ${running ? 'status-dot-pulse' : ''}`}
          style={{ background: err ? STATUS_COLOR.error : done ? phase : running ? STATUS_COLOR.running : 'var(--text-faint)', width: 6, height: 6 }}
        />
        <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
          {data.label}
        </span>
        {data.id === 'critic' && (
          <span className="rounded px-1" style={{ fontSize: 8, fontWeight: 600, background: 'var(--accent-purple-dim)', color: 'var(--accent-purple-soft)' }}>debate</span>
        )}
        {running && <Loader2 size={10} className="spin ml-auto" style={{ color: 'var(--accent-purple)' }} />}
      </div>
      <div
        className={`truncate ${running ? 'node-shimmer' : ''}`}
        style={{ marginTop: 5, fontSize: 11, color: status === 'idle' ? 'var(--text-faint)' : 'var(--text-secondary)' }}
      >
        {data.subtitle || 'waiting'}
      </div>
    </div>
  );
}

const nodeTypes = { pipe: PipelineNode };

export default function PipelineGraph({ nodeStates, subtitles, onNodeClick }) {
  const graphNodes = useMemo(
    () =>
      ORDERED_NODES.map((id) => ({
        id,
        type: 'pipe',
        position: POS[id],
        draggable: false,
        data: { id, label: NODES[id].label, status: statusOf(nodeStates, id), subtitle: subtitles[id], onClick: onNodeClick },
      })),
    [nodeStates, subtitles, onNodeClick]
  );

  const graphEdges = useMemo(() => {
    const link = (src) => {
      const done = statusOf(nodeStates, src) === 'done';
      const color = done ? nodeColor(src) : 'var(--bg-border-strong)';
      return { animated: done, style: { stroke: color, strokeWidth: done ? 1.6 : 1 } };
    };
    const chain = [['scraper', 'filter'], ['filter', 'selector'], ['selector', 'fetcher'], ['fetcher', 'writer']].map(
      ([s, t]) => ({ id: `${s}-${t}`, source: s, sourceHandle: 'r', target: t, targetHandle: 'l', type: 'smoothstep', ...link(s) })
    );
    const loopDown = {
      id: 'writer-critic', source: 'writer', sourceHandle: 'bl', target: 'critic', targetHandle: 'tl',
      type: 'straight', animated: true, label: 'review', labelStyle: { fontSize: 9, fill: 'var(--accent-purple-soft)' },
      labelBgStyle: { fill: 'transparent' }, style: { stroke: 'var(--accent-purple)', strokeWidth: 1.5 },
    };
    const loopUp = {
      id: 'critic-writer', source: 'critic', sourceHandle: 'tr', target: 'writer', targetHandle: 'br',
      type: 'straight', animated: true, label: 'revise', labelStyle: { fontSize: 9, fill: 'var(--accent-purple-soft)' },
      labelBgStyle: { fill: 'transparent' }, style: { stroke: 'var(--accent-purple)', strokeWidth: 1.5, strokeDasharray: '5 4' },
    };
    const toFormatter = { id: 'writer-formatter', source: 'writer', sourceHandle: 'b', target: 'formatter', targetHandle: 'r', type: 'smoothstep', ...link('writer') };
    const tail = [['formatter', 'saver']].map(([s, t]) => ({ id: `${s}-${t}`, source: s, sourceHandle: 'l', target: t, targetHandle: 'r', type: 'smoothstep', ...link(s) }));
    return [...chain, loopDown, loopUp, toFormatter, ...tail];
  }, [nodeStates]);

  const [nodes, setNodes] = useNodesState(graphNodes);
  const [edges, setEdges] = useEdgesState(graphEdges);

  useEffect(() => {
    setNodes((prev) => {
      const incoming = new Map(graphNodes.map((n) => [n.id, n]));
      if (!prev.length) return graphNodes;
      return prev.map((n) => ({ ...n, data: incoming.get(n.id)?.data || n.data }));
    });
  }, [graphNodes, setNodes]);

  useEffect(() => setEdges(graphEdges), [graphEdges, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.22, minZoom: 0.4 }}
      panOnScroll
      nodesDraggable={false}
      minZoom={0.3}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant="dots" gap={22} size={1} color="rgba(128,128,150,0.16)" />
    </ReactFlow>
  );
}
