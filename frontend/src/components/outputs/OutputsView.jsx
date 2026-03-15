import { BarChart2, Clock, ExternalLink, FileText, RefreshCw, Star, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import MarkdownPreview from './MarkdownPreview';
import MetricCard from './MetricCard';

function parseBlogPost(raw) {
  const fmMatch = (raw || '').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return { frontmatter: {}, content: raw || '' };
  const lines = fmMatch[1].split('\n');
  const fm = {};
  lines.forEach((line) => {
    const [k, ...v] = line.split(':');
    if (k) fm[k.trim()] = v.join(':').trim().replace(/^'|'$/g, '');
  });
  return { frontmatter: fm, content: fmMatch[2].trim() };
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
  { key: 'blog',     label: 'Blog Post',     icon: FileText },
  { key: 'linkedin', label: 'LinkedIn',       icon: null, svgType: 'linkedin' },
  { key: 'youtube',  label: 'YouTube',        icon: null, svgType: 'youtube' },
  { key: 'metrics',  label: 'Metrics',        icon: BarChart2 },
];

const TAB_ACCENT = {
  blog:     'var(--text-primary)',
  linkedin: '#3B82F6',
  youtube:  '#EF4444',
  metrics:  'var(--accent-purple)',
};

function LinkedInIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path d="M7 9H10V18H7V9ZM8.5 6.5C9.33 6.5 10 7.17 10 8C10 8.83 9.33 9.5 8.5 9.5C7.67 9.5 7 8.83 7 8C7 7.17 7.67 6.5 8.5 6.5ZM12 9H14.9V10.2H15C15.4 9.45 16.4 8.8 17.9 8.8C21 8.8 21 10.85 21 13.5V18H18V14C18 13.05 17.98 11.85 16.7 11.85C15.4 11.85 15.2 12.86 15.2 13.93V18H12V9Z" fill="white" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#EF4444" />
      <path d="M16.6 11.2L10.8 8.1C10.3 7.8 9.7 8.2 9.7 8.8V15.2C9.7 15.8 10.3 16.2 10.8 15.9L16.6 12.8C17.1 12.5 17.1 11.5 16.6 11.2Z" fill="white" />
    </svg>
  );
}

export default function OutputsView({ runs, selectedRunId, onSelectRun, runData, loading, onToast }) {
  const [blogText, setBlogText] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('blog');
  const [splitPercent, setSplitPercent] = useState(50);
  const [dragging, setDragging] = useState(false);

  const parsedBlog = useMemo(() => parseBlogPost(runData?.blog_post || ''), [runData?.blog_post]);

  useEffect(() => {
    setBlogText(parsedBlog.content || '');
  }, [parsedBlog.content]);

  useEffect(() => {
    const onEscape = () => setEditorOpen(false);
    const onCopyShortcut = async () => {
      if (!runData) return;
      if (activeTab === 'blog')     { await copy(blogText, 'Blog markdown'); return; }
      if (activeTab === 'linkedin') { await copy(runData.linkedin_post || '', 'LinkedIn post'); return; }
      await copy(runData.youtube_script || '', 'YouTube script');
    };
    window.addEventListener('agenticblog:escape', onEscape);
    window.addEventListener('agenticblog:copy-active-output', onCopyShortcut);
    return () => {
      window.removeEventListener('agenticblog:escape', onEscape);
      window.removeEventListener('agenticblog:copy-active-output', onCopyShortcut);
    };
  }, [activeTab, blogText, runData]);

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (e) => {
      const container = document.getElementById('blog-editor-split');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setSplitPercent(Math.max(20, Math.min(80, ((e.clientX - rect.left) / rect.width) * 100)));
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const metadata = runData?.metadata || {};
  const frontmatter = parsedBlog.frontmatter || {};
  const blogTitle = frontmatter.title || metadata?.selected_article?.title || 'Generated blog post';
  const linkedinText = runData?.linkedin_post || '';
  const youtubeText = runData?.youtube_script || '';
  const linkedinCount = linkedinText.length;
  const youtubeWords = (runData?.youtube_script || '').split(/\s+/).filter(Boolean).length;
  const estimatedMinutes = Math.max(1, Math.round(youtubeWords / 130));
  const blogWordCount = blogText.split(/\s+/).filter(Boolean).length;
  const engagementEstimate = Math.max(20, Math.round(linkedinCount / 22));
  const criticScore = Number(metadata?.critique_score || 0);
  const criticColor = criticScore >= 8 ? '#22C55E' : criticScore >= 6 ? '#F59E0B' : '#EF4444';

  const runOptions = useMemo(
    () => runs.map((run) => ({ id: run.slug || run.run_id, label: `${run.run_id.slice(0, 8)} · ${run.run_date} · ${run.active_category}` })),
    [runs]
  );

  const copy = async (text, label) => {
    await navigator.clipboard.writeText(text || '');
    onToast(`${label} copied`, 'success');
  };

  const hashtagTokens = useMemo(() => linkedinText.split(/(#[\w-]+)/g).filter(Boolean), [linkedinText]);
  const youtubeTokens = useMemo(() => youtubeText.split(/(\[\d+s\])/g).filter(Boolean), [youtubeText]);

  async function saveBlogChanges() {
    if (!selectedRunId) { onToast('No run selected', 'error'); return; }
    try {
      const res = await fetch(`/api/runs/${selectedRunId}/blog`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: blogText, blog_post: blogText }),
      });
      if (!res.ok) throw new Error('Unable to save blog draft');
      setEditorOpen(false);
      onToast('Blog changes saved', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Run header bar */}
      <div
        className="flex flex-shrink-0 items-center gap-3 border-b px-4 py-2"
        style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-surface)' }}
      >
        <select
          value={selectedRunId || ''}
          onChange={(e) => onSelectRun(e.target.value)}
          className="mono rounded-md border px-2 py-1 text-[11px]"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
        >
          {runOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>

        {runData && (
          <>
            <span
              className="hidden min-w-0 flex-1 truncate text-[13px] font-semibold md:block"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.3px' }}
              title={blogTitle}
            >
              {blogTitle}
            </span>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <span
                className="rounded px-1.5 py-0.5 text-[10px]"
                style={{ backgroundColor: 'rgba(139,92,246,0.12)', color: '#A78BFA' }}
              >
                {frontmatter.category || metadata.active_category || 'general'}
              </span>
              <span className="mono text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                {frontmatter.words || metadata.word_count || blogWordCount}w
              </span>
              <span
                className="mono text-[10px]"
                style={{ color: criticColor }}
              >
                {criticScore}/10
              </span>
              {metadata?.selected_article?.url && (
                <a
                  href={metadata.selected_article.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--text-muted)' }}
                  title="Source article"
                >
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          </>
        )}
      </div>

      {/* Output tabs */}
      <div
        className="flex flex-shrink-0 items-center gap-0 border-b"
        style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-surface)', paddingLeft: 16 }}
      >
        {TABS.map(({ key, label, icon: Icon, svgType }) => {
          const active = activeTab === key;
          const accent = TAB_ACCENT[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                color: active ? accent : 'var(--text-secondary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'color 150ms',
                whiteSpace: 'nowrap',
              }}
            >
              {svgType === 'linkedin' && <LinkedInIcon />}
              {svgType === 'youtube' && <YouTubeIcon />}
              {Icon && <Icon size={12} />}
              {label}
              {active && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 14,
                    right: 14,
                    height: 2,
                    borderRadius: '2px 2px 0 0',
                    backgroundColor: accent,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
        {loading && (
          <div className="p-6 space-y-4">
            <div className="skeleton h-8 w-2/3 rounded" />
            <div className="space-y-2">
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-[94%] rounded" />
              <div className="skeleton h-3 w-[88%] rounded" />
              <div className="skeleton h-40 w-full rounded" />
            </div>
          </div>
        )}

        {!loading && !runData && (
          <div className="flex h-full flex-col items-center justify-center text-center py-20">
            <FileText size={40} style={{ color: 'var(--text-muted)' }} />
            <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Select a category and run the pipeline
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Outputs will appear here after execution
            </p>
          </div>
        )}

        {!loading && runData && (
          <>
            {/* Blog Tab */}
            {activeTab === 'blog' && (
              <div className="h-full flex flex-col">
                {/* Blog toolbar */}
                <div
                  className="flex flex-shrink-0 items-center justify-between border-b px-4 py-2"
                  style={{ borderColor: 'var(--bg-border)' }}
                >
                  <div className="flex items-center gap-2">
                    {editorOpen ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditorOpen(false)}
                          className="rounded border px-2 py-1 text-xs"
                          style={{ borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
                        >
                          ← Preview
                        </button>
                        <button
                          type="button"
                          onClick={saveBlogChanges}
                          className="rounded border px-2 py-1 text-xs"
                          style={{ borderColor: 'rgba(139,92,246,0.4)', color: '#C4B5FD' }}
                        >
                          Save changes
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditorOpen(true)}
                        className="rounded border px-2 py-1 text-xs"
                        style={{ borderColor: 'rgba(139,92,246,0.4)', color: '#A78BFA' }}
                      >
                        Edit ↗
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {blogWordCount}w
                    </span>
                    <button
                      type="button"
                      title="Cmd/Ctrl+C"
                      onClick={() => copy(blogText, 'Blog markdown')}
                      className="rounded border px-2 py-1 text-xs"
                      style={{ borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
                    >
                      Copy <span className="kbd-badge">⌘C</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadText('blog_post.md', blogText)}
                      className="rounded border px-2 py-1 text-xs"
                      style={{ borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
                    >
                      Download
                    </button>
                  </div>
                </div>

                {/* Blog content */}
                {!editorOpen ? (
                  <div className="flex-1 overflow-auto custom-scrollbar px-4 py-6">
                    <div className="mx-auto max-w-3xl">
                      <MarkdownPreview content={blogText} />
                    </div>
                  </div>
                ) : (
                  <div id="blog-editor-split" className="flex flex-1">
                    <textarea
                      value={blogText}
                      onChange={(e) => setBlogText(e.target.value)}
                      className="mono h-full resize-none border-0 p-4 text-[11px] leading-[1.7] outline-none"
                      style={{ width: `${splitPercent}%`, backgroundColor: 'var(--surface-code)', color: 'var(--text-primary)' }}
                    />
                    <button
                      type="button"
                      aria-label="Resize split"
                      className="h-full w-[5px]"
                      style={{ backgroundColor: 'var(--bg-border)', cursor: 'col-resize', flexShrink: 0 }}
                      onMouseDown={() => setDragging(true)}
                    />
                    <div
                      className="custom-scrollbar h-full overflow-y-auto p-4"
                      style={{ width: `${100 - splitPercent}%`, backgroundColor: 'var(--surface-code)' }}
                    >
                      <MarkdownPreview content={blogText} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LinkedIn Tab */}
            {activeTab === 'linkedin' && (
              <div className="p-6">
                <div className="mx-auto max-w-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <span
                      className="mono text-[11px]"
                      style={{ color: linkedinCount < 2000 ? '#22C55E' : linkedinCount <= 2800 ? '#F59E0B' : '#EF4444' }}
                    >
                      {linkedinCount} / 3000
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        title="Cmd/Ctrl+C"
                        onClick={() => copy(linkedinText, 'LinkedIn post')}
                        className="rounded border px-2 py-1 text-xs"
                        style={{ borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
                      >
                        Copy <span className="kbd-badge">⌘C</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadText('linkedin_post.md', linkedinText)}
                        className="rounded border px-2 py-1 text-xs"
                        style={{ borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
                      >
                        Download
                      </button>
                    </div>
                  </div>

                  {/* LinkedIn card mockup */}
                  <div
                    className="rounded-xl border overflow-hidden"
                    style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-elevated)' }}
                  >
                    <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--bg-border)' }}>
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ background: 'var(--brand-gradient)', color: '#fff', flexShrink: 0 }}
                      >
                        M
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                          Mohamad El Akhal
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                          {frontmatter.category || metadata.active_category || 'Tech'} · just now
                        </p>
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <p className="whitespace-pre-wrap text-[13px] leading-[1.75]" style={{ color: 'var(--text-secondary)' }}>
                        {hashtagTokens.map((token, idx) =>
                          token.startsWith('#') ? (
                            <span key={`hash-${idx}`} style={{ color: '#60A5FA' }}>{token}</span>
                          ) : (
                            <span key={`txt-${idx}`}>{token}</span>
                          )
                        )}
                      </p>
                    </div>
                    <div
                      className="flex items-center gap-4 border-t px-4 py-2 text-[11px]"
                      style={{ borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
                    >
                      <span>👍 Like</span>
                      <span>💬 Comment</span>
                      <span>↗ Share</span>
                      <span className="ml-auto">~{engagementEstimate} estimated reactions</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* YouTube Tab */}
            {activeTab === 'youtube' && (
              <div className="p-6">
                <div className="mx-auto max-w-2xl">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      ~{estimatedMinutes} min · {youtubeWords} words
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        title="Cmd/Ctrl+C"
                        onClick={() => copy(youtubeText, 'YouTube script')}
                        className="rounded border px-2 py-1 text-xs"
                        style={{ borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
                      >
                        Copy <span className="kbd-badge">⌘C</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadText('youtube_script.md', youtubeText)}
                        className="rounded border px-2 py-1 text-xs"
                        style={{ borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
                      >
                        Download
                      </button>
                    </div>
                  </div>
                  <div
                    className="rounded-lg border p-4 custom-scrollbar"
                    style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-surface)' }}
                  >
                    <p className="whitespace-pre-wrap text-[12px] leading-[1.8]" style={{ color: 'var(--text-secondary)' }}>
                      {youtubeTokens.map((token, idx) =>
                        /^\[\d+s\]$/.test(token) ? (
                          <span
                            key={`ts-${idx}`}
                            className="mono mr-1 inline-flex rounded px-1.5 py-[1px]"
                            style={{ backgroundColor: 'var(--bg-elevated)', color: '#F59E0B' }}
                          >
                            {token}
                          </span>
                        ) : (
                          <span key={`yt-${idx}`}>{token}</span>
                        )
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Metrics Tab */}
            {activeTab === 'metrics' && (
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <MetricCard label="tokens" value={metadata?.total_tokens_used || 0} icon={Zap} />
                  <MetricCard label="duration" value={`${metadata?.duration_seconds || 0}s`} icon={Clock} />
                  <MetricCard label="iterations" value={`${metadata?.iteration_count || 0}/3`} icon={RefreshCw} />
                  <MetricCard
                    label="critic score"
                    value={`${metadata?.critique_score || 0}/10`}
                    icon={Star}
                    valueColor={criticColor}
                  />
                </div>
                {metadata?.fetch_method && (
                  <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
                    <div className="glass-card p-4">
                      <p className="label mb-1">Fetch method</p>
                      <p className="mono text-[14px]" style={{ color: 'var(--text-primary)' }}>
                        {metadata.fetch_method}
                      </p>
                    </div>
                    <div className="glass-card p-4">
                      <p className="label mb-1">Word count</p>
                      <p className="mono text-[14px]" style={{ color: 'var(--text-primary)' }}>
                        {metadata.word_count || blogWordCount}
                      </p>
                    </div>
                    <div className="glass-card p-4">
                      <p className="label mb-1">Category</p>
                      <p className="mono text-[14px]" style={{ color: 'var(--text-primary)' }}>
                        {metadata.active_category || '—'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
