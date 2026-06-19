import { TrendingUp } from 'lucide-react';
import { scoreColor } from '../../lib/pipeline';

const APPROVAL = 7;

// Compact line chart of the critique score per iteration. The dashed line is the
// approval threshold; a point at/above it means the draft was accepted.
export default function ScoreTrajectory({ debates = [], maxIterations = 3 }) {
  const points = debates.map((d) => ({ it: d.iteration || 0, score: d.score || 0, approved: d.approved }));
  const W = 260;
  const H = 120;
  const padX = 26;
  const padY = 16;
  const span = Math.max(maxIterations - 1, 1);
  const x = (it) => padX + ((Math.max(it, 1) - 1) / span) * (W - padX * 2);
  const y = (s) => padY + (1 - s / 10) * (H - padY * 2);

  return (
    <div className="panel">
      <div className="panel-head">
        <TrendingUp size={14} style={{ color: 'var(--accent-purple-soft)' }} />
        <span className="panel-title" style={{ color: 'var(--text-primary)' }}>Score trajectory</span>
      </div>
      <div className="p-3">
        {points.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '14px 4px' }}>Scores appear as the critic runs.</p>
        ) : (
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
            {/* gridlines */}
            {[0, 5, 10].map((g) => (
              <g key={g}>
                <line x1={padX} y1={y(g)} x2={W - padX} y2={y(g)} stroke="var(--bg-border)" strokeWidth="1" />
                <text x={padX - 6} y={y(g) + 3} textAnchor="end" fontSize="8" fill="var(--text-faint)" fontFamily="JetBrains Mono">{g}</text>
              </g>
            ))}
            {/* approval threshold */}
            <line x1={padX} y1={y(APPROVAL)} x2={W - padX} y2={y(APPROVAL)} stroke="var(--accent-green)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <text x={W - padX} y={y(APPROVAL) - 4} textAnchor="end" fontSize="8" fill="var(--accent-green)" fontFamily="JetBrains Mono">approve ≥ 7</text>

            {/* line */}
            {points.length > 1 && (
              <polyline
                fill="none"
                stroke="var(--accent-purple)"
                strokeWidth="1.6"
                points={points.map((p) => `${x(p.it)},${y(p.score)}`).join(' ')}
              />
            )}
            {/* points */}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={x(p.it)} cy={y(p.score)} r="4.5" fill={scoreColor(p.score)} stroke="var(--bg-surface)" strokeWidth="1.5" />
                <text x={x(p.it)} y={y(p.score) - 9} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--text-primary)" fontFamily="JetBrains Mono">{p.score}</text>
                <text x={x(p.it)} y={H - 3} textAnchor="middle" fontSize="8" fill="var(--text-faint)" fontFamily="JetBrains Mono">v{p.it}</text>
              </g>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
