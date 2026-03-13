import { useEffect, useMemo, useRef, useState } from 'react';
import NodeCard from './NodeCard';

const NODES_ROW_1 = ['scraper', 'filter', 'selector', 'fetcher'];
const NODES_ROW_2 = ['critic', 'writer', 'formatter', 'saver'];

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export default function NodeGraph({ nodeStates, subtitles, onNodeClick }) {
  const containerRef = useRef(null);
  const nodeRefs = useRef({});
  const [lines, setLines] = useState([]);

  const allNodes = useMemo(() => [...NODES_ROW_1, ...NODES_ROW_2], []);

  useEffect(() => {
    const recalc = () => {
      const root = containerRef.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();

      const point = (key, side = 'right') => {
        const el = nodeRefs.current[key];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const y = r.top - rootRect.top + r.height / 2;
        if (side === 'left') return { x: r.left - rootRect.left, y };
        if (side === 'top') return { x: r.left - rootRect.left + r.width / 2, y: r.top - rootRect.top };
        if (side === 'bottom') return { x: r.left - rootRect.left + r.width / 2, y: r.bottom - rootRect.top };
        return { x: r.right - rootRect.left, y };
      };

      const next = [];
      next.push({ from: point('scraper'), to: point('filter', 'left'), type: 'line' });
      next.push({ from: point('filter'), to: point('selector', 'left'), type: 'line' });
      next.push({ from: point('selector'), to: point('fetcher', 'left'), type: 'line' });
      next.push({ from: point('saver', 'left'), to: point('formatter'), type: 'line' });
      next.push({ from: point('formatter', 'left'), to: point('writer'), type: 'line' });

      const fetcherBottom = point('fetcher', 'bottom');
      const writerTop = point('writer', 'top');
      if (fetcherBottom && writerTop) {
        next.push({
          from: fetcherBottom,
          to: writerTop,
          type: 'curve',
        });
      }

      const writerRight = point('writer', 'right');
      const criticLeft = point('critic', 'left');
      const criticRight = point('critic', 'right');
      const writerLeft = point('writer', 'left');

      if (writerRight && criticLeft) {
        next.push({ from: writerRight, to: criticLeft, type: 'dashed' });
      }
      if (criticRight && writerLeft) {
        next.push({ from: criticRight, to: writerLeft, type: 'dashed' });
      }

      setLines(next.filter((l) => l.from && l.to));
    };

    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [nodeStates]);

  return (
    <div ref={containerRef} className="relative pt-7">
      <p className="label absolute left-0 top-0">Node Graph</p>

      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill="var(--bg-hover)" />
          </marker>
        </defs>
        {lines.map((line, index) => {
          if (line.type === 'curve') {
            const mid = midpoint(line.from, line.to);
            return (
              <path
                key={`line-${index}`}
                d={`M ${line.from.x} ${line.from.y} C ${line.from.x} ${mid.y + 24}, ${line.to.x} ${mid.y - 24}, ${line.to.x} ${line.to.y}`}
                fill="none"
                stroke="var(--bg-hover)"
                strokeWidth="1"
                markerEnd="url(#arrow)"
              />
            );
          }

          return (
            <line
              key={`line-${index}`}
              x1={line.from.x}
              y1={line.from.y}
              x2={line.to.x}
              y2={line.to.y}
              stroke={line.type === 'dashed' ? 'var(--accent-purple)' : 'var(--bg-hover)'}
              strokeWidth="1"
              className={line.type === 'dashed' ? 'flow-dashed' : ''}
              markerEnd="url(#arrow)"
            />
          );
        })}
      </svg>

      <div className="relative z-10 flex justify-center gap-6">
        {NODES_ROW_1.map((node) => (
          <NodeCard
            key={node}
            ref={(el) => {
              nodeRefs.current[node] = el;
            }}
            node={node}
            state={nodeStates.get(node)}
            subtitle={subtitles[node]}
            onClick={() => onNodeClick(node)}
          />
        ))}
      </div>

      <div className="relative z-10 mt-14 flex justify-center gap-6">
        {NODES_ROW_2.map((node) => (
          <NodeCard
            key={node}
            ref={(el) => {
              nodeRefs.current[node] = el;
            }}
            node={node}
            state={nodeStates.get(node)}
            subtitle={subtitles[node]}
            onClick={() => onNodeClick(node)}
          />
        ))}
      </div>

      <div className="h-4" />
    </div>
  );
}
