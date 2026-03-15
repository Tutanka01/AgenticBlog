import { ExternalLink, PlayCircle, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

const CATEGORY_COLORS = {
  security: '#EF4444',
  infra:    '#22C55E',
  ai:       '#8B5CF6',
  cloud:    '#3B82F6',
  africa:   '#F59E0B',
};

function scoreColor(score) {
  if (score >= 7) return 'var(--accent-green)';
  if (score >= 5) return 'var(--accent-amber)';
  return 'var(--accent-red)';
}

function scoreBg(score) {
  if (score >= 7) return 'rgba(34,197,94,0.1)';
  if (score >= 5) return 'rgba(245,158,11,0.1)';
  return 'rgba(239,68,68,0.1)';
}

export default function HistoryView({ runs, onOpenOutputs, onResume, onDelete, onToast }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return runs.filter((run) => {
      const matchesCategory = categoryFilter === 'all' || run.active_category === categoryFilter;
      const text = `${run.run_id} ${run.selected_article?.title || ''}`.toLowerCase();
      return matchesCategory && text.includes(search.toLowerCase());
    });
  }, [runs, categoryFilter, search]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const avgScore = (filtered.reduce((s, r) => s + (r.critique_score || 0), 0) / filtered.length).toFixed(1);
    const totalTokens = filtered.reduce((s, r) => s + (r.total_tokens_used || 0), 0);
    const avgDuration = Math.round(filtered.reduce((s, r) => s + (r.duration_seconds || 0), 0) / filtered.length);
    return { avgScore, totalTokens, avgDuration };
  }, [filtered]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const visiblePages = useMemo(() => {
    const pages = [];
    for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
      pages.push(i);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <div className="h-full overflow-auto custom-scrollbar px-4 py-4">
      {/* Filters row */}
      <div
        className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 border-b pb-3"
        style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-base)' }}
      >
        {/* Search (left) */}
        <div className="relative flex items-center">
          <Search size={12} className="absolute left-2.5" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search run id or article"
            className="rounded-md border py-1.5 pl-7 pr-3 text-[12px]"
            style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', width: 220 }}
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-1.5">
          {['all', 'security', 'infra', 'ai', 'cloud', 'africa'].map((cat) => (
            <button
              key={cat}
              onClick={() => { setCategoryFilter(cat); setPage(1); }}
              className="rounded-[5px] border px-2 py-1 text-[11px] transition duration-100"
              style={{
                borderColor: categoryFilter === cat ? 'var(--accent-purple-border)' : 'var(--bg-border)',
                backgroundColor: categoryFilter === cat ? 'var(--accent-purple-dim)' : 'var(--bg-elevated)',
                color: categoryFilter === cat ? 'var(--accent-purple)' : 'var(--text-secondary)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Aggregate stats */}
        {stats && (
          <div className="ml-auto flex items-center gap-3 mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span>{filtered.length} runs</span>
            <span>·</span>
            <span>avg <span style={{ color: 'var(--text-secondary)' }}>{stats.avgScore}</span>/10</span>
            <span>·</span>
            <span><span style={{ color: 'var(--text-secondary)' }}>{(stats.totalTokens / 1000).toFixed(0)}k</span> tok</span>
            <span>·</span>
            <span>avg <span style={{ color: 'var(--text-secondary)' }}>{stats.avgDuration}s</span></span>
          </div>
        )}
      </div>

      {/* Table */}
      {pageItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Search size={36} style={{ color: 'var(--text-muted)' }} />
          <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>No runs found</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--bg-border)' }}>
          <table className="w-full border-collapse text-sm">
            <thead style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <tr className="text-left" style={{ color: 'var(--text-secondary)' }}>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em]">Date</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em]">Run ID</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em]">Cat</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em]">Article</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em]">Score</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em]">Tokens</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em]">Duration</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((run) => (
                <tr
                  key={`${run.run_id}-${run.run_date}`}
                  className="border-t transition-colors duration-100"
                  style={{ borderColor: 'var(--bg-border)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                >
                  <td className="px-3 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    {run.run_date}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      className="mono text-[11px]"
                      style={{ color: 'var(--text-secondary)' }}
                      title="Click to copy full run ID"
                      onClick={async () => {
                        await navigator.clipboard.writeText(run.run_id);
                        onToast('Copied!', 'success');
                      }}
                    >
                      {run.run_id.slice(0, 8)}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${CATEGORY_COLORS[run.active_category] || '#6b7280'}1a`,
                        color: CATEGORY_COLORS[run.active_category] || '#6b7280',
                      }}
                    >
                      {run.active_category}
                    </span>
                  </td>
                  <td
                    className="px-3 py-2.5 text-[12px]"
                    style={{ maxWidth: 320, color: 'var(--text-secondary)' }}
                    title={run.selected_article?.title || ''}
                  >
                    <span className="line-clamp-1 block overflow-hidden text-ellipsis">
                      {run.selected_article?.title || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="rounded px-1.5 py-0.5 mono text-[10px] font-medium"
                      style={{
                        color: scoreColor(run.critique_score || 0),
                        backgroundColor: scoreBg(run.critique_score || 0),
                      }}
                    >
                      {run.critique_score || 0}/10
                    </span>
                  </td>
                  <td className="mono px-3 py-2.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {run.total_tokens_used || 0}
                  </td>
                  <td className="mono px-3 py-2.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {run.duration_seconds || 0}s
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onOpenOutputs(run.slug || run.run_id)}
                        title="View outputs"
                        className="rounded p-1.5 transition-colors duration-100"
                        style={{ color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      >
                        <ExternalLink size={13} />
                      </button>
                      <button
                        onClick={() => onResume(run.run_id)}
                        title="Resume run"
                        className="rounded p-1.5 transition-colors duration-100"
                        style={{ color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--accent-purple)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      >
                        <PlayCircle size={13} />
                      </button>
                      <button
                        onClick={() => onDelete(run.slug || run.run_id)}
                        title="Delete run"
                        className="rounded p-1.5 transition-colors duration-100"
                        style={{ color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-1">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded px-2 py-1 text-xs disabled:opacity-30"
            style={{ color: 'var(--text-secondary)' }}
          >
            ←
          </button>
          {visiblePages.map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className="rounded px-2.5 py-1 text-xs mono"
              style={{
                backgroundColor: p === page ? 'var(--accent-purple-dim)' : 'transparent',
                color: p === page ? 'var(--accent-purple)' : 'var(--text-secondary)',
                border: p === page ? '1px solid var(--accent-purple-border)' : '1px solid transparent',
              }}
            >
              {p}
            </button>
          ))}
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded px-2 py-1 text-xs disabled:opacity-30"
            style={{ color: 'var(--text-secondary)' }}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
