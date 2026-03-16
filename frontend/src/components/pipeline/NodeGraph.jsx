import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { Copy, Loader2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import '@xyflow/react/dist/style.css';

// Pipeline order for iteration purposes
const ORDERED_NODES = ['scraper', 'filter', 'selector', 'fetcher', 'writer', 'critic', 'formatter', 'saver'];

// New topology: horizontal chain with critic as vertical satellite below writer
//
//  [scraper] → [filter] → [selector] → [fetcher] → [writer]
//                                                      ↕
//  [saver]  ← [formatter] ←────────────────────── [critic]
//
const NODE_POSITIONS = {
  scraper:   { x: 40,  y: 80 },
  filter:    { x: 240, y: 80 },
  selector:  { x: 440, y: 80 },
  fetcher:   { x: 640, y: 80 },
  writer:    { x: 840, y: 80 },
  critic:    { x: 840, y: 270 },
  formatter: { x: 640, y: 270 },
  saver:     { x: 440, y: 270 },
};

const STATUS_STYLE = {
  idle: {
    bg: 'var(--bg-elevated)',
    border: 'var(--bg-hover)',
    dot: 'var(--text-muted)',
    shadow: 'none',
  },
  running: {
    bg: 'rgba(139,92,246,0.07)',
    border: 'rgba(139,92,246,0.5)',
    dot: '#8B5CF6',
    shadow: 'var(--node-running-glow)',
    topAccent: 'none',
  },
  done: {
    bg: 'rgba(34,197,94,0.04)',
    border: 'rgba(34,197,94,0.22)',
    dot: '#22C55E',
    shadow: 'none',
    topAccent: '#22C55E',
  },
  error: {
    bg: 'rgba(239,68,68,0.05)',
    border: 'rgba(239,68,68,0.3)',
    dot: '#EF4444',
    shadow: 'none',
  },
};

function nodeStatus(nodeStates, id) {
  return nodeStates.get(id)?.status || 'idle';
}

function PipelineNode({ data }) {
  const status = data.status || 'idle';
  const visual = STATUS_STYLE[status] || STATUS_STYLE.idle;

  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{
        width: 160,
        background: visual.bg,
        border: status === 'running' ? `1.5px solid ${visual.border}` : `1px solid ${visual.border}`,
        boxShadow: visual.shadow,
        borderTop: visual.topAccent ? `2px solid ${visual.topAccent}` : undefined,
        cursor: status === 'done' ? 'pointer' : 'default',
        transition: 'border-color 300ms ease, background 300ms ease, box-shadow 300ms ease',
      }}
      onClick={() => {
        if (status === 'done') data.onClickDetail();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' && status === 'done') data.onClickDetail(); }}
    >
      {/* Hidden handles for edges */}
      <Handle id="left"         type="target" position={Position.Left}   style={{ opacity: 0 }} />
      <Handle id="right"        type="source" position={Position.Right}  style={{ opacity: 0 }} />
      <Handle id="top"          type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle id="bottom"       type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      {/* Offset handles for the writer↔critic loop (side-by-side arrows) */}
      <Handle id="bottom-left"  type="source" position={Position.Bottom} style={{ opacity: 0, left: '38%' }} />
      <Handle id="bottom-right" type="target" position={Position.Bottom} style={{ opacity: 0, left: '62%' }} />
      <Handle id="top-left"    type="target"  position={Position.Top}    style={{ opacity: 0, left: '38%' }} />
      <Handle id="top-right"   type="source"  position={Position.Top}    style={{ opacity: 0, left: '62%' }} />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--text-primary)' }}>
          <span
            className={`h-[6px] w-[6px] rounded-full flex-shrink-0 ${status === 'running' ? 'status-dot-pulse' : ''}`}
            style={{ backgroundColor: visual.dot }}
          />
          <span>{data.label}</span>
          {data.label === 'critic' && (
            <span
              className="rounded px-1 text-[8px] font-medium"
              style={{ backgroundColor: 'rgba(139,92,246,0.15)', color: '#A78BFA', letterSpacing: '0.03em', fontWeight: 500 }}
            >
              debate
            </span>
          )}
          {status === 'running' && <Loader2 size={10} className="animate-spin" style={{ color: '#8B5CF6' }} />}
        </div>

        <button
          type="button"
          className="inline-flex items-center rounded px-1 py-0.5"
          style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)' }}
          onClick={async (e) => {
            e.stopPropagation();
            await navigator.clipboard.writeText(JSON.stringify(data.meta || {}, null, 2));
          }}
          title="Copy payload"
        >
          <Copy size={9} />
        </button>
      </div>

      <div
        className={`mt-1.5 text-[11px] leading-snug truncate ${status === 'running' ? 'node-shimmer' : ''}`}
        style={{ color: status === 'idle' ? 'var(--text-muted)' : 'var(--text-secondary)' }}
      >
        {data.subtitle || 'waiting'}
      </div>
    </div>
  );
}

// Group box: dashed rectangle grouping writer + critic as a loop unit
function GroupBoxNode({ data }) {
  return (
    <div
      style={{
        width: data.width,
        height: data.height,
        border: '1px dashed rgba(139,92,246,0.25)',
        borderRadius: 12,
        backgroundColor: 'rgba(139,92,246,0.03)',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 6,
          left: 10,
          fontSize: 9,
          fontFamily: 'JetBrains Mono, monospace',
          color: 'rgba(139,92,246,0.5)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {data.label}
      </span>
    </div>
  );
}

const nodeTypes = { pipelineNode: PipelineNode, groupBox: GroupBoxNode };

export default function NodeGraph({ nodeStates, subtitles, onNodeClick }) {
  const graphNodes = useMemo(() => {
    const loopGroup = {
      id: 'loop-group',
      type: 'groupBox',
      position: { x: 820, y: 58 },
      draggable: false,
      selectable: false,
      zIndex: -1,
      data: { label: 'multi-critic · debate · max 3×', width: 200, height: 264 },
    };

    const pipelineNodes = ORDERED_NODES.map((id) => ({
      id,
      type: 'pipelineNode',
      position: NODE_POSITIONS[id],
      draggable: false,
      data: {
        label: id === 'saver' ? 'saver' : id,
        status: nodeStatus(nodeStates, id),
        subtitle: subtitles[id],
        meta: nodeStates.get(id)?.meta || {},
        onClickDetail: () => onNodeClick(id),
      },
    }));

    return [loopGroup, ...pipelineNodes];
  }, [nodeStates, onNodeClick, subtitles]);

  const graphEdges = useMemo(() => {
    const linkStyle = (source) => {
      const status = nodeStatus(nodeStates, source);
      const done = status === 'done';
      return {
        animated: done,
        style: done
          ? { stroke: '#22C55E', strokeWidth: 1.5 }
          : { stroke: 'var(--bg-hover)', strokeWidth: 1 },
      };
    };

    // Top row: left-to-right horizontal chain
    const topRow = [
      ['scraper', 'filter'],
      ['filter', 'selector'],
      ['selector', 'fetcher'],
      ['fetcher', 'writer'],
    ].map(([src, tgt]) => ({
      id: `${src}-${tgt}`,
      source: src, sourceHandle: 'right',
      target: tgt, targetHandle: 'left',
      type: 'smoothstep',
      ...linkStyle(src),
    }));

    // Writer → Critic (downward, left side)
    const writerDown = {
      id: 'writer-critic',
      source: 'writer', sourceHandle: 'bottom-left',
      target: 'critic', targetHandle: 'top-left',
      type: 'straight',
      animated: true,
      label: 'review',
      labelStyle: { fontSize: 9, fill: 'rgba(139,92,246,0.6)' },
      labelBgStyle: { fill: 'transparent' },
      style: { stroke: '#8B5CF6', strokeWidth: 1.5 },
    };

    // Critic → Writer (upward, right side — dashed)
    const criticUp = {
      id: 'critic-writer',
      source: 'critic', sourceHandle: 'top-right',
      target: 'writer', targetHandle: 'bottom-right',
      type: 'straight',
      animated: true,
      label: 'revise',
      labelStyle: { fontSize: 9, fill: 'rgba(139,92,246,0.6)' },
      labelBgStyle: { fill: 'transparent' },
      style: { stroke: '#8B5CF6', strokeWidth: 1.5, strokeDasharray: '5 4' },
    };

    // Writer → Formatter (descent, right-to-left on bottom row)
    const writerFormatter = {
      id: 'writer-formatter',
      source: 'writer', sourceHandle: 'bottom',
      target: 'formatter', targetHandle: 'right',
      type: 'smoothstep',
      ...linkStyle('writer'),
    };

    // Bottom row: right-to-left
    const bottomRow = [
      ['formatter', 'saver'],
    ].map(([src, tgt]) => ({
      id: `${src}-${tgt}`,
      source: src, sourceHandle: 'left',
      target: tgt, targetHandle: 'right',
      type: 'smoothstep',
      ...linkStyle(src),
    }));

    return [...topRow, writerDown, criticUp, writerFormatter, ...bottomRow];
  }, [nodeStates]);

  const [nodes, setNodes, onNodesChange] = useNodesState(graphNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphEdges);

  useEffect(() => {
    setNodes((prev) => {
      const incoming = new Map(graphNodes.map((n) => [n.id, n]));
      if (!prev.length) return graphNodes;
      return prev.map((n) => {
        const next = incoming.get(n.id);
        if (!next) return n;
        return { ...n, data: next.data };
      });
    });
  }, [graphNodes, setNodes]);

  useEffect(() => {
    setEdges(graphEdges);
  }, [graphEdges, setEdges]);

  return (
    <div className="h-full" style={{ backgroundColor: 'var(--bg-base)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.28, minZoom: 0.4 }}
        panOnScroll
        zoomOnScroll
        nodesDraggable={false}
        minZoom={0.25}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant="dots" gap={22} size={1} color="rgba(128,128,150,0.18)" />
        <Controls
          showInteractive={false}
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--bg-border)',
            borderRadius: '20px',
            padding: '4px',
          }}
        />
      </ReactFlow>
    </div>
  );
}
