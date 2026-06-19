import { Check, ExternalLink, Filter, Trophy } from 'lucide-react';
import { MODE_META, scoreColor } from '../../lib/pipeline';

function ScoreBadge({ score }) {
  const color = scoreColor(score);
  return (
    <span
      className="mono flex items-center justify-center rounded-md"
      style={{ width: 34, height: 26, flexShrink: 0, fontSize: 12, fontWeight: 700, color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {score}
    </span>
  );
}

function SelectedCard({ selection }) {
  const s = selection.selected || {};
  const b = selection.breakdown || {};
  const mode = MODE_META[selection.mode] || MODE_META.category;
  return (
    <div className="panel-raised" style={{ padding: 13, borderLeft: '2.5px solid var(--accent-green)' }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <Trophy size={13} style={{ color: 'var(--accent-green)' }} />
        <span className="eyebrow" style={{ color: 'var(--accent-green)' }}>Selected</span>
        <span className="chip" style={{ marginLeft: 'auto', fontSize: 10, color: mode.color, borderColor: 'var(--bg-border)' }}>
          {mode.glyph} {mode.label}
        </span>
      </div>
      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{s.title || '—'}</p>
      {b && Object.keys(b).length > 0 && !b.fallback && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mono" style={{ marginTop: 9, fontSize: 11 }}>
          {b.llm_score != null && <span style={{ color: 'var(--text-muted)' }}>relevance <b style={{ color: 'var(--text-secondary)' }}>{b.llm_score}</b></span>}
          {b.freshness_bonus != null && <span style={{ color: 'var(--text-muted)' }}>+ freshness <b style={{ color: 'var(--accent-green)' }}>{b.freshness_bonus}</b></span>}
          {b.novelty_penalty != null && <span style={{ color: 'var(--text-muted)' }}>− novelty <b style={{ color: 'var(--accent-amber)' }}>{b.novelty_penalty}</b></span>}
          {b.composite != null && <span style={{ color: 'var(--text-muted)' }}>= composite <b style={{ color: 'var(--accent-purple-soft)' }}>{b.composite}</b></span>}
        </div>
      )}
      {selection.memory_runs > 0 && (
        <p className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 8 }}>{selection.memory_runs} runs in editorial memory</p>
      )}
    </div>
  );
}

export default function CandidatesPanel({ data, selection }) {
  const candidates = data?.candidates || [];
  const kept = candidates.filter((c) => c.kept).length;

  return (
    <div className="panel slide-up">
      <div className="panel-head" style={{ justifyContent: 'space-between' }}>
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: 'var(--accent-green)' }} />
          <span className="panel-title" style={{ color: 'var(--text-primary)' }}>Curation</span>
        </div>
        {data && (
          <div className="flex items-center gap-1.5">
            <span className="chip mono" style={{ fontSize: 10 }}>{kept} kept / {data.raw_count} scored</span>
            {data.threshold != null && <span className="chip mono" style={{ fontSize: 10 }}>≥ {data.threshold}</span>}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3">
        {selection?.selected?.title && <SelectedCard selection={selection} />}

        {candidates.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {candidates.map((c, i) => (
              <div
                key={c.url || i}
                className="flex items-start gap-3 rounded-lg px-2.5 py-2"
                style={{ background: c.kept ? 'var(--bg-elevated)' : 'transparent', opacity: c.kept ? 1 : 0.62 }}
              >
                <ScoreBadge score={c.score} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate" style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{c.title}</p>
                    {c.url && c.url.startsWith('http') && (
                      <a href={c.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-faint)', flexShrink: 0 }} title="Open source">
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                  {c.reason && <p className="truncate" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{c.reason}</p>}
                </div>
                {c.kept ? (
                  <span className="flex items-center gap-1" style={{ fontSize: 10, color: 'var(--accent-green)', flexShrink: 0 }}>
                    <Check size={11} /> kept
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>cut</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '8px 2px' }}>
            {selection ? 'Direct mode — no scoring step for this run.' : 'Scored candidates will appear here.'}
          </p>
        )}
      </div>
    </div>
  );
}
