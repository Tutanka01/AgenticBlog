import { AlertTriangle, MessagesSquare } from 'lucide-react';
import { useMemo } from 'react';
import { initials, personaColor } from '../../lib/pipeline';
import ScoreGauge from '../ui/ScoreGauge';

function normalizePersonas(personas = []) {
  return personas.map((p) => (typeof p === 'string' ? { name: p } : p));
}

// Split the raw debate transcript into rounds → per-persona critique sections.
function parseTranscript(transcript) {
  if (!transcript) return [];
  const parts = transcript.split(/##\s*Round\s*(\d+)/i);
  const rounds = [];
  for (let i = 1; i < parts.length; i += 2) {
    const num = parts[i];
    const body = (parts[i + 1] || '').replace(/^\s*-{3,}\s*$/gm, '').trim();
    const sections = [];
    for (const chunk of body.split(/\n(?=###\s)/)) {
      const m = chunk.match(/^###\s*(.+)/);
      if (m) sections.push({ name: m[1].trim(), text: chunk.slice(m[0].length).trim() });
      else if (chunk.trim()) sections.push({ name: null, text: chunk.trim() });
    }
    rounds.push({ num, sections });
  }
  return rounds;
}

function colorForName(name, personas) {
  if (!name) return personaColor(0);
  const idx = personas.findIndex((p) => p.name && name.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]));
  return personaColor(idx >= 0 ? idx : 0);
}

function PersonaCard({ persona, color }) {
  return (
    <div className="panel-raised" style={{ padding: 11, borderLeft: `2.5px solid ${color}` }}>
      <div className="flex items-center gap-2.5">
        <span
          className="flex items-center justify-center rounded-full mono"
          style={{ width: 30, height: 30, flexShrink: 0, background: `color-mix(in srgb, ${color} 20%, transparent)`, color, fontSize: 11, fontWeight: 700 }}
        >
          {initials(persona.name) || '?'}
        </span>
        <div className="min-w-0">
          <p className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{persona.name}</p>
          <p className="truncate" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{persona.role}</p>
        </div>
      </div>
      {persona.primary_concern && (
        <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.45 }}>
          <span style={{ color }}>Lens · </span>{persona.primary_concern}
        </p>
      )}
    </div>
  );
}

export default function DebatePanel({ data, live }) {
  const personas = useMemo(() => normalizePersonas(data?.personas), [data?.personas]);
  const rounds = useMemo(() => parseTranscript(data?.transcript), [data?.transcript]);

  const hasVerdict = data?.score != null && data?.transcript;
  const approved = data?.approved;
  const issues = Array.isArray(data?.issues) ? data.issues.filter(Boolean) : [];

  if (!personas.length && !data) {
    return (
      <div className="panel flex flex-col items-center justify-center" style={{ padding: 36, minHeight: 220 }}>
        <MessagesSquare size={24} style={{ color: 'var(--text-faint)' }} />
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10 }}>The debate panel appears once the critic runs.</p>
      </div>
    );
  }

  return (
    <div className="panel slide-up">
      <div className="panel-head" style={{ justifyContent: 'space-between' }}>
        <div className="flex items-center gap-2">
          <MessagesSquare size={14} style={{ color: 'var(--accent-purple-soft)' }} />
          <span className="panel-title" style={{ color: 'var(--text-primary)' }}>Debate panel</span>
          {data?.iteration != null && (
            <span className="chip mono" style={{ fontSize: 10 }}>iteration {data.iteration}</span>
          )}
          {(data?.rounds || data?.num_personas) && (
            <span className="chip mono" style={{ fontSize: 10 }}>
              {personas.length || data?.num_personas} critics · {data?.rounds || rounds.length} rounds
            </span>
          )}
        </div>
        {hasVerdict ? (
          <span
            className="chip"
            style={{
              borderColor: approved ? 'rgba(34,197,94,0.4)' : 'rgba(245,158,11,0.4)',
              color: approved ? 'var(--accent-green)' : 'var(--accent-amber)',
              background: approved ? 'var(--accent-green-dim)' : 'rgba(245,158,11,0.08)',
            }}
          >
            {approved ? 'approved' : 'needs revision'}
          </span>
        ) : (
          live && <span className="chip mono node-shimmer" style={{ fontSize: 10 }}>debating…</span>
        )}
      </div>

      <div className="p-4">
        {/* Security flag */}
        {data?.security_flag && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 mb-4"
            style={{ border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.07)', color: '#fca5a5', fontSize: 12 }}
          >
            <AlertTriangle size={13} style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>Security flag</span>
            <span style={{ color: 'var(--text-secondary)' }}>— a code snippet was flagged as dangerous; approval was overridden.</span>
          </div>
        )}

        {/* Personas + verdict */}
        <div className="flex gap-4" style={{ alignItems: 'stretch' }}>
          <div className="grid flex-1 gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(personas.length || 1, 3)}, minmax(0,1fr))` }}>
            {personas.map((p, i) => (
              <PersonaCard key={p.name || i} persona={p} color={personaColor(i)} />
            ))}
          </div>
          {hasVerdict && (
            <div className="panel-raised flex flex-col items-center justify-center" style={{ padding: 12, width: 132, flexShrink: 0 }}>
              <ScoreGauge score={data.score} size={80} />
              {data.best_score > data.score && (
                <p className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>best {data.best_score}/10</p>
              )}
              {data.stagnation_count > 0 && (
                <p className="mono" style={{ fontSize: 10, color: 'var(--accent-amber)', marginTop: 4 }}>stagnation ×{data.stagnation_count}</p>
              )}
            </div>
          )}
        </div>

        {/* Transcript by round */}
        {rounds.length > 0 ? (
          <div className="mt-4 flex flex-col gap-4">
            {rounds.map((round) => (
              <div key={round.num}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-purple-soft)' }}>Round {round.num}</span>
                  <span className="hairline flex-1" />
                </div>
                <div className="flex flex-col gap-2">
                  {round.sections.map((s, i) => {
                    const color = colorForName(s.name, personas);
                    return (
                      <div key={i} className="panel-raised" style={{ padding: '10px 12px', borderLeft: `2.5px solid ${color}` }}>
                        {s.name && (
                          <p className="mono" style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 4 }}>{s.name}</p>
                        )}
                        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          live && personas.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <div className="skeleton" style={{ height: 44 }} />
              <div className="skeleton" style={{ height: 44, width: '80%' }} />
            </div>
          )
        )}

        {/* Synthesized corrections */}
        {issues.length > 0 && (
          <div className="mt-4">
            <p className="eyebrow" style={{ marginBottom: 8 }}>Synthesized corrections</p>
            <ul className="flex flex-col gap-1.5">
              {issues.map((iss, i) => (
                <li key={i} className="flex gap-2" style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--accent-amber)', flexShrink: 0 }}>→</span>
                  <span>{typeof iss === 'string' ? iss : JSON.stringify(iss)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
