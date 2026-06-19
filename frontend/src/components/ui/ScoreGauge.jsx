import { scoreColor } from '../../lib/pipeline';

// Circular 0–10 score gauge. The ring colour follows the score band.
export default function ScoreGauge({ score = 0, size = 76, stroke = 7, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(10, score)) / 10;
  const color = scoreColor(score);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle className="gauge-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="gauge-value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ lineHeight: 1 }}
      >
        <span className="mono" style={{ fontSize: size * 0.3, fontWeight: 700, color: 'var(--text-primary)' }}>{score}</span>
        <span className="mono" style={{ fontSize: size * 0.13, color: 'var(--text-muted)', marginTop: 2 }}>{label || '/ 10'}</span>
      </div>
    </div>
  );
}
