import { useEffect, useMemo, useState } from 'react';
import MarkdownPreview from './MarkdownPreview';
import MetricCard from './MetricCard';

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function OutputsView({
  runs,
  selectedRunId,
  onSelectRun,
  runData,
  loading,
  onToast,
}) {
  const [blogText, setBlogText] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    setBlogText(runData?.blog_post || '');
  }, [runData]);

  const metadata = runData?.metadata;

  const linkedinCount = runData?.linkedin_post?.length || 0;
  const youtubeWords = (runData?.youtube_script || '').split(/\s+/).filter(Boolean).length;
  const estimatedMinutes = Math.max(1, Math.round(youtubeWords / 130));

  const runOptions = useMemo(
    () => runs.map((run) => ({ id: run.slug || run.run_id, label: `${run.run_id.slice(0, 8)} · ${run.run_date} · ${run.active_category}` })),
    [runs]
  );

  const copy = async (text, label) => {
    await navigator.clipboard.writeText(text || '');
    onToast(`${label} copied`, 'success');
  };

  return (
    <div className="h-full overflow-auto px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="label">Run selector</p>
        <select
          value={selectedRunId || ''}
          onChange={(e) => onSelectRun(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-sm"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--bg-border)' }}
        >
          {runOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading outputs...</p>}

      {!loading && runData && (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <section className="card p-4">
              <h2 className="mb-2 line-clamp-2 text-[15px] font-bold tracking-[-0.4px]" style={{ color: 'var(--text-primary)' }}>
                {metadata?.selected_article?.title || 'Blog post'}
              </h2>
              <div className="mb-3 flex flex-wrap gap-1 text-[10px]">
                <span className="rounded-[5px] px-1.5 py-0.5" style={{ backgroundColor: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' }}>
                  {metadata?.active_category}
                </span>
                <span className="rounded-[5px] border px-1.5 py-0.5">{metadata?.run_date}</span>
                <span className="rounded-[5px] border px-1.5 py-0.5">{metadata?.word_count} words</span>
                <span className="rounded-[5px] border px-1.5 py-0.5">{metadata?.critique_score}/10</span>
              </div>
              <div
                className="max-h-[300px] overflow-y-auto rounded-md border p-3"
                style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-elevated)' }}
              >
                <MarkdownPreview content={blogText} />
              </div>
              <div className="mt-3 flex gap-2 text-xs">
                <button onClick={() => copy(blogText, 'Blog markdown')} className="rounded-md border px-2 py-1">Copy markdown</button>
                <button onClick={() => downloadText('blog_post.md', blogText)} className="rounded-md border px-2 py-1">Download .md</button>
                <button onClick={() => setEditorOpen(true)} className="rounded-md border px-2 py-1">Open editor →</button>
              </div>
            </section>

            <section className="card p-4">
              <h2 className="mb-2 text-[15px] font-bold tracking-[-0.4px]">LinkedIn</h2>
              <div className="mb-2 rounded-md border p-3" style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-elevated)' }}>
                <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {runData.linkedin_post}
                </p>
              </div>
              <p className="mono text-[11px]" style={{ color: linkedinCount > 2800 ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                {linkedinCount} / 3000 caractères
              </p>
              <div className="mt-3 flex gap-2 text-xs">
                <button onClick={() => copy(runData.linkedin_post, 'LinkedIn post')} className="rounded-md border px-2 py-1">Copy</button>
                <button onClick={() => downloadText('linkedin_post.md', runData.linkedin_post)} className="rounded-md border px-2 py-1">Download</button>
              </div>
            </section>

            <section className="card p-4">
              <h2 className="mb-2 text-[15px] font-bold tracking-[-0.4px]">YouTube</h2>
              <div className="mb-2 rounded-md border p-3" style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-elevated)' }}>
                <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {runData.youtube_script}
                </p>
              </div>
              <p className="mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>~{estimatedMinutes}min</p>
              <div className="mt-3 flex gap-2 text-xs">
                <button onClick={() => copy(runData.youtube_script, 'YouTube script')} className="rounded-md border px-2 py-1">Copy</button>
                <button onClick={() => downloadText('youtube_script.md', runData.youtube_script)} className="rounded-md border px-2 py-1">Download</button>
              </div>
            </section>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="tokens" value={metadata?.total_tokens_used || 0} />
            <MetricCard label="durée" value={`${metadata?.duration_seconds || 0}s`} />
            <MetricCard label="itérations" value={`${metadata?.iteration_count || 0}/3`} />
            <MetricCard label="critic" value={`${metadata?.critique_score || 0}/10`} />
          </div>
        </>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 p-6">
          <div className="mx-auto flex h-full max-w-5xl flex-col rounded-lg border p-4" style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-surface)' }}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Blog editor</p>
              <button onClick={() => setEditorOpen(false)} className="rounded-md border px-2 py-1 text-xs">Close</button>
            </div>
            <textarea
              value={blogText}
              onChange={(e) => setBlogText(e.target.value)}
              className="mono flex-1 rounded-md border p-3 text-xs"
              style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  onToast('Blog draft saved in editor', 'success');
                  setEditorOpen(false);
                }}
                className="rounded-md border px-3 py-1.5 text-xs"
                style={{ borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
