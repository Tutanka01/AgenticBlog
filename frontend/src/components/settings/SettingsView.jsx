import { Cpu, Rss, SlidersHorizontal } from 'lucide-react';

function Stat({ label, value, hint }) {
  return (
    <div className="panel-raised" style={{ padding: 14 }}>
      <p className="eyebrow">{label}</p>
      <p className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 5 }}>{value}</p>
      {hint && <p style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 3 }}>{hint}</p>}
    </div>
  );
}

export default function SettingsView({ config }) {
  if (!config) return <div className="p-6"><div className="skeleton" style={{ height: 200 }} /></div>;

  const t = config.thresholds || {};
  const m = config.models || {};

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="mx-auto max-w-[940px] px-7 py-7">
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 620 }}>
          Read-only view of the active pipeline configuration. These come from <span className="mono">config.py</span> and your <span className="mono">.env</span>.
        </p>

        {/* Thresholds */}
        <div className="mt-6 flex items-center gap-2">
          <SlidersHorizontal size={14} style={{ color: 'var(--accent-purple-soft)' }} />
          <span className="panel-title" style={{ color: 'var(--text-primary)' }}>Thresholds</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Filter threshold" value={t.filter_threshold} hint="min score to keep" />
          <Stat label="Top N filtered" value={t.top_n_filtered} hint="passed to selector" />
          <Stat label="Max articles" value={t.max_articles_to_fetch} hint="fetched per run" />
          <Stat label="Critique max" value={t.max_critique_iterations} hint="writer ⇄ critic loops" />
          <Stat label="Debate personas" value={t.num_debate_personas} />
          <Stat label="Debate rounds" value={t.debate_rounds} />
        </div>

        {/* Models */}
        <div className="mt-7 flex items-center gap-2">
          <Cpu size={14} style={{ color: 'var(--accent-blue)' }} />
          <span className="panel-title" style={{ color: 'var(--text-primary)' }}>Models</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="panel-raised" style={{ padding: 14 }}>
            <p className="eyebrow">Writer / synthesis</p>
            <p className="mono" style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 5, wordBreak: 'break-all' }}>{m.writer}</p>
          </div>
          <div className="panel-raised" style={{ padding: 14 }}>
            <p className="eyebrow">Debate rounds</p>
            <p className="mono" style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 5, wordBreak: 'break-all' }}>{m.debate}</p>
          </div>
        </div>

        {/* Categories */}
        <div className="mt-7 flex items-center gap-2">
          <Rss size={14} style={{ color: 'var(--accent-green)' }} />
          <span className="panel-title" style={{ color: 'var(--text-primary)' }}>Categories &amp; feeds</span>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {config.categories?.map((c) => (
            <div key={c.id} className="panel" style={{ padding: 16 }}>
              <div className="flex items-center gap-2.5">
                <span className="dot" style={{ background: c.color, width: 10, height: 10 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{c.label}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>{c.id}</span>
                <span className="chip mono ml-auto" style={{ fontSize: 10 }}>{c.feeds?.length || 0} feeds</span>
              </div>
              {c.topics?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.topics.map((tp) => <span key={tp} className="chip" style={{ fontSize: 10.5, padding: '2px 8px' }}>{tp}</span>)}
                </div>
              )}
              {c.feeds?.length > 0 && (
                <div className="mt-3 flex flex-col gap-1">
                  {c.feeds.map((f) => (
                    <a key={f} href={f} target="_blank" rel="noreferrer" className="mono truncate" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f}</a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
