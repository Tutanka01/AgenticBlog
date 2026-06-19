import { BarChart3, Copy, Download, FileText, GitBranch, Pencil, Save, Share2, Youtube } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MODE_META, scoreColor } from '../../lib/pipeline';
import { useRunState } from '../../hooks/useRunState';
import CandidatesPanel from '../live/CandidatesPanel';
import DebatePanel from '../live/DebatePanel';
import ScoreGauge from '../ui/ScoreGauge';
import MarkdownPreview from './MarkdownPreview';

function parseFrontmatter(raw) {
  const m = (raw || '').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw || '' };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (v) fm[k] = v;
  }
  return { fm, body: m[2].trim() };
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const TABS = [
  { key: 'blog', label: 'Blog', icon: FileText },
  { key: 'linkedin', label: 'LinkedIn', icon: Share2 },
  { key: 'youtube', label: 'YouTube', icon: Youtube },
  { key: 'provenance', label: 'Provenance', icon: GitBranch },
  { key: 'metrics', label: 'Metrics', icon: BarChart3 },
];

function RunRail({ runs, selectedRunId, onSelectRun }) {
  return (
    <div className="custom-scrollbar overflow-y-auto" style={{ width: 244, flexShrink: 0, borderRight: '1px solid var(--bg-border)', padding: 10 }}>
      {runs.map((r) => {
        const id = r.slug || r.run_id;
        const on = id === selectedRunId;
        const mode = MODE_META[r.mode] || MODE_META.category;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelectRun(id)}
            className="mb-1.5 w-full rounded-[10px] px-3 py-2.5 text-left"
            style={{ background: on ? 'var(--bg-elevated)' : 'transparent', border: `1px solid ${on ? 'var(--bg-border-strong)' : 'transparent'}` }}
          >
            <div className="flex items-center gap-2">
              <span className="dot" style={{ background: scoreColor(r.critique_score), width: 7, height: 7 }} />
              <span className="truncate" style={{ fontSize: 12.5, fontWeight: on ? 600 : 500, color: 'var(--text-primary)' }}>
                {r.selected_article?.title || 'Untitled'}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
              <span>{r.run_date}</span>
              <span style={{ color: mode.color }}>{mode.glyph} {r.mode}</span>
              {r.security_flag && <span style={{ color: 'var(--accent-red)' }}>⚠</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Provenance({ runId }) {
  const { state, loading } = useRunState(runId);
  if (loading) return <div className="skeleton" style={{ height: 200, margin: 16 }} />;
  if (!state) return <p style={{ padding: 24, color: 'var(--text-muted)' }}>No provenance recorded for this run.</p>;

  const d = state.debate || {};
  const debateData = {
    personas: d.personas,
    transcript: d.transcript,
    score: d.final_score,
    best_score: d.best_score,
    approved: d.approved,
    security_flag: d.security_flag,
    stagnation_count: d.stagnation_count,
    issues: d.feedback ? d.feedback.split('\n').filter(Boolean) : [],
    rounds: d.rounds,
    num_personas: d.personas?.length,
  };
  const selection = { selected: state.selected_article, mode: state.mode };

  return (
    <div className="flex flex-col gap-4 p-4">
      {state.legacy && (
        <p className="chip" style={{ alignSelf: 'flex-start', color: 'var(--text-muted)' }}>
          Legacy run — limited provenance (predates full state capture).
        </p>
      )}
      <CandidatesPanel data={{ candidates: state.candidates, raw_count: state.raw_count }} selection={selection} />
      {(d.personas?.length > 0 || d.transcript) && <DebatePanel data={debateData} live={false} />}
      {state.memory_context && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title" style={{ color: 'var(--text-primary)' }}>Editorial memory injected into the writer</span></div>
          <div className="p-4"><MarkdownPreview content={state.memory_context} /></div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, color }) {
  return (
    <div className="panel-raised" style={{ padding: 14 }}>
      <p className="eyebrow">{label}</p>
      <p className="mono" style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text-primary)', marginTop: 6 }}>{value}</p>
    </div>
  );
}

export default function ReviewView({ runs, selectedRunId, onSelectRun, runData, loading, onToast }) {
  const [tab, setTab] = useState('blog');
  const [editing, setEditing] = useState(false);
  const [blogText, setBlogText] = useState('');

  const meta = runData?.metadata;
  const parsed = useMemo(() => parseFrontmatter(runData?.blog_post || ''), [runData?.blog_post]);

  useEffect(() => { setBlogText(parsed.body); setEditing(false); }, [parsed.body, selectedRunId]);

  const copy = async (text, label) => {
    await navigator.clipboard.writeText(text || '');
    onToast(`${label} copied`, 'success');
  };

  const saveBlog = async () => {
    const full = runData?.blog_post?.startsWith('---')
      ? runData.blog_post.replace(/^(---\n[\s\S]*?\n---\n)[\s\S]*$/, `$1${blogText}`)
      : blogText;
    const res = await fetch(`/api/runs/${selectedRunId}/blog`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: full }),
    });
    if (res.ok) { onToast('Blog saved', 'success'); setEditing(false); }
    else onToast('Save failed', 'error');
  };

  if (!loading && runs.length === 0) {
    return <div className="flex h-full items-center justify-center"><p style={{ color: 'var(--text-muted)' }}>No runs yet — launch one from Compose.</p></div>;
  }

  const mode = MODE_META[meta?.mode] || MODE_META.category;
  const currentText = tab === 'linkedin' ? runData?.linkedin_post : tab === 'youtube' ? runData?.youtube_script : blogText;

  return (
    <div className="flex h-full">
      <RunRail runs={runs} selectedRunId={selectedRunId} onSelectRun={onSelectRun} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3" style={{ borderBottom: '1px solid var(--bg-border)' }}>
          <div className="min-w-0">
            <p className="truncate" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {parsed.fm.title || meta?.selected_article?.title || 'Untitled'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="chip" style={{ fontSize: 10, color: mode.color }}>{mode.glyph} {mode.label}</span>
              <span className="chip mono" style={{ fontSize: 10 }}>{meta?.active_category}</span>
              {meta?.critique_score > 0 && (
                <span className="chip mono" style={{ fontSize: 10, color: scoreColor(meta.critique_score) }}>{meta.critique_score}/10</span>
              )}
              <span className="chip mono" style={{ fontSize: 10 }}>{meta?.word_count || 0} words</span>
              {meta?.security_flag && <span className="chip" style={{ fontSize: 10, color: 'var(--accent-red)' }}>⚠ security</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {tab === 'blog' && (
              editing ? (
                <button type="button" className="btn btn-primary" style={{ height: 32 }} onClick={saveBlog}><Save size={13} /> Save</button>
              ) : (
                <button type="button" className="btn" style={{ height: 32 }} onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>
              )
            )}
            {(tab === 'blog' || tab === 'linkedin' || tab === 'youtube') && (
              <>
                <button type="button" className="btn" style={{ height: 32 }} onClick={() => copy(currentText, TABS.find((t) => t.key === tab).label)}><Copy size={13} /></button>
                <button type="button" className="btn" style={{ height: 32 }} onClick={() => downloadText(`${tab}.md`, currentText || '')}><Download size={13} /></button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 py-2" style={{ borderBottom: '1px solid var(--bg-border)' }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.key;
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)} className="btn btn-ghost" style={{ height: 30, color: on ? 'var(--text-primary)' : 'var(--text-muted)', background: on ? 'var(--bg-elevated)' : 'transparent' }}>
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="skeleton" style={{ height: 240, margin: 20 }} />
          ) : tab === 'provenance' ? (
            <Provenance runId={selectedRunId} />
          ) : tab === 'metrics' ? (
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
              <div className="panel-raised flex items-center justify-center" style={{ padding: 14, gridRow: 'span 2' }}>
                <ScoreGauge score={meta?.critique_score || 0} size={96} />
              </div>
              <Metric label="Iterations" value={meta?.iteration_count || 0} />
              <Metric label="Approved" value={meta?.critique_approved ? 'yes' : 'no'} color={meta?.critique_approved ? 'var(--accent-green)' : 'var(--accent-amber)'} />
              <Metric label="Words" value={meta?.word_count || 0} />
              <Metric label="Tokens" value={(meta?.total_tokens_used || 0).toLocaleString()} />
              <Metric label="Personas" value={meta?.personas?.length || 0} />
              <Metric label="Language" value={(meta?.output_language || 'en').toUpperCase()} />
            </div>
          ) : tab === 'blog' && editing ? (
            <textarea
              className="custom-scrollbar mono"
              value={blogText}
              onChange={(e) => setBlogText(e.target.value)}
              style={{ width: '100%', height: '100%', minHeight: 360, border: 'none', outline: 'none', resize: 'none', background: 'var(--surface-code)', color: 'var(--text-primary)', padding: 24, fontSize: 13, lineHeight: 1.7 }}
            />
          ) : (
            <div className="mx-auto max-w-[760px] px-8 py-7">
              {tab === 'blog' && <MarkdownPreview content={blogText} />}
              {tab === 'linkedin' && <MarkdownPreview content={runData?.linkedin_post} />}
              {tab === 'youtube' && <MarkdownPreview content={runData?.youtube_script} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
