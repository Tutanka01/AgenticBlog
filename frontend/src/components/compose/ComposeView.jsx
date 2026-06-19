import { Link2, Play, Rss, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NODES, ORDERED_NODES, nodeColor } from '../../lib/pipeline';

const MODES = [
  { id: 'category', label: 'Category', icon: Rss, blurb: 'Scrape RSS feeds, score and pick the best article.' },
  { id: 'url', label: 'Direct URL', icon: Link2, blurb: 'Write from one specific article you already have.' },
  { id: 'topic', label: 'Free topic', icon: Sparkles, blurb: 'Write from a prompt — no source article at all.' },
];

// Stages each mode bypasses (mirrors the graph's direct-url / direct-topic shortcuts).
const SKIPPED = {
  category: [],
  url: ['scraper', 'filter', 'selector'],
  topic: ['scraper', 'filter', 'selector', 'fetcher'],
};

function StagePreview({ mode }) {
  const skipped = SKIPPED[mode] || [];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ORDERED_NODES.map((id, i) => {
        const off = skipped.includes(id);
        return (
          <span key={id} className="flex items-center gap-1.5">
            <span
              className="rounded-md px-2 py-1 mono"
              style={{
                fontSize: 10.5,
                background: off ? 'transparent' : 'var(--bg-elevated)',
                border: `1px solid ${off ? 'var(--bg-border)' : 'transparent'}`,
                color: off ? 'var(--text-faint)' : nodeColor(id),
                textDecoration: off ? 'line-through' : 'none',
                opacity: off ? 0.6 : 1,
              }}
            >
              {NODES[id].label}
            </span>
            {i < ORDERED_NODES.length - 1 && <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>›</span>}
          </span>
        );
      })}
    </div>
  );
}

export default function ComposeView({ config, isRunning, defaults, onLaunch }) {
  const categories = config?.categories || [];
  const languages = config?.languages || [{ id: 'fr', label: 'French' }, { id: 'en', label: 'English' }, { id: 'ar', label: 'Arabic' }];

  const [mode, setMode] = useState(defaults?.mode || 'category');
  const [category, setCategory] = useState(defaults?.category || 'infra');
  const [lang, setLang] = useState(defaults?.lang || 'en');
  const [url, setUrl] = useState('');
  const [topic, setTopic] = useState('');

  useEffect(() => {
    if (categories.length && !categories.find((c) => c.id === category)) setCategory(categories[0].id);
  }, [categories, category]);

  const activeCat = useMemo(() => categories.find((c) => c.id === category), [categories, category]);

  const canLaunch = !isRunning && (mode === 'category' || (mode === 'url' && url.trim()) || (mode === 'topic' && topic.trim()));

  const submit = () => {
    if (!canLaunch) return;
    onLaunch({ mode, category, lang, url: url.trim(), topic: topic.trim() });
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="mx-auto max-w-[860px] px-8 py-9">
        {/* Mode selector */}
        <p className="eyebrow" style={{ marginBottom: 10 }}>Source</p>
        <div className="grid grid-cols-3 gap-3">
          {MODES.map((m) => {
            const Icon = m.icon;
            const on = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className="panel text-left transition-all"
                style={{
                  padding: 14,
                  borderColor: on ? 'var(--accent-purple-border)' : 'var(--bg-border)',
                  boxShadow: on ? 'var(--glow-purple)' : 'none',
                  background: on ? 'var(--accent-purple-dim)' : 'var(--bg-surface)',
                }}
              >
                <Icon size={18} style={{ color: on ? 'var(--accent-purple-soft)' : 'var(--text-muted)' }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 9 }}>{m.label}</p>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.45 }}>{m.blurb}</p>
              </button>
            );
          })}
        </div>

        {/* Mode-specific input */}
        <div className="mt-6">
          {mode === 'category' && (
            <>
              <p className="eyebrow" style={{ marginBottom: 10 }}>Category</p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {categories.map((c) => {
                  const on = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className="panel flex items-center gap-2.5 text-left"
                      style={{
                        padding: '11px 12px',
                        borderColor: on ? c.color : 'var(--bg-border)',
                        background: on ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                      }}
                    >
                      <span className="dot" style={{ background: c.color, width: 9, height: 9 }} />
                      <span className="min-w-0">
                        <span className="block truncate" style={{ fontSize: 13, fontWeight: on ? 600 : 500, color: 'var(--text-primary)' }}>{c.label}</span>
                        <span className="mono block" style={{ fontSize: 10, color: 'var(--text-faint)' }}>{c.feeds?.length || 0} feeds</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {activeCat?.topics?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {activeCat.topics.slice(0, 10).map((t) => (
                    <span key={t} className="chip" style={{ fontSize: 10.5, padding: '2px 8px' }}>{t}</span>
                  ))}
                </div>
              )}
            </>
          )}

          {mode === 'url' && (
            <>
              <p className="eyebrow" style={{ marginBottom: 10 }}>Article URL</p>
              <input
                className="field mono"
                style={{ fontSize: 13 }}
                placeholder="https://example.com/the-article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                autoFocus
              />
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
                The fetcher pulls the full content; scraping, filtering and selection are skipped. The category below still seeds editorial memory.
              </p>
            </>
          )}

          {mode === 'topic' && (
            <>
              <p className="eyebrow" style={{ marginBottom: 10 }}>Topic prompt</p>
              <textarea
                className="field"
                style={{ minHeight: 96, resize: 'vertical', lineHeight: 1.55 }}
                placeholder="e.g. How eBPF is changing Linux observability"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                autoFocus
              />
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
                The writer drafts directly from your prompt — no source article, no fetching. Best for opinion pieces and explainers.
              </p>
            </>
          )}
        </div>

        {/* Category + language row (category shown as memory seed for url/topic) */}
        <div className="mt-6 flex flex-wrap items-end gap-5">
          {mode !== 'category' && categories.length > 0 && (
            <div>
              <p className="eyebrow" style={{ marginBottom: 8 }}>Memory category</p>
              <select className="field" style={{ width: 200 }} value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          )}
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Output language</p>
            <div className="flex gap-1.5">
              {languages.map((l) => {
                const on = lang === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLang(l.id)}
                    className="btn"
                    style={{
                      height: 38, minWidth: 52, textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.04em',
                      borderColor: on ? 'var(--accent-purple-border)' : 'var(--bg-border-strong)',
                      background: on ? 'var(--accent-purple-dim)' : 'var(--bg-elevated)',
                      color: on ? 'var(--accent-purple-soft)' : 'var(--text-secondary)',
                    }}
                    title={l.label}
                  >
                    {l.id}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pipeline preview + launch */}
        <div className="panel mt-8" style={{ padding: 16 }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="eyebrow" style={{ marginBottom: 10 }}>Pipeline for this run</p>
              <StagePreview mode={mode} />
            </div>
            <button type="button" className="btn btn-primary" style={{ height: 42, padding: '0 22px', fontSize: 14 }} disabled={!canLaunch} onClick={submit}>
              <Play size={15} /> {isRunning ? 'Run in progress…' : 'Launch run'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
