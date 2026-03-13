import { Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

const CATEGORY_COLORS = {
  security: '#EF4444',
  infra: '#22C55E',
  ai: '#8B5CF6',
  cloud: '#3B82F6',
  africa: '#F59E0B',
};

function scoreColor(score) {
  if (score >= 7) return 'var(--accent-green)';
  if (score >= 5) return 'var(--accent-amber)';
  return 'var(--accent-red)';
}

export default function HistoryView({ runs, onOpenOutputs, onResume, onDelete, onToast }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return runs.filter((run) => {
      const matchesCategory = categoryFilter === 'all' || run.active_category === categoryFilter;
      const text = `${run.run_id} ${run.selected_article?.title || ''}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [runs, categoryFilter, search]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="h-full overflow-auto px-4 py-4">
      <div
        className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 border-b pb-3"
        style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-base)' }}
      >
        {['all', 'security', 'infra', 'ai', 'cloud', 'africa'].map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setCategoryFilter(cat);
              setPage(1);
            }}
            className="rounded-[5px] border px-2 py-1 text-xs"
            style={{
              borderColor: categoryFilter === cat ? 'var(--accent-purple-border)' : 'var(--bg-border)',
              backgroundColor: categoryFilter === cat ? 'var(--accent-purple-dim)' : 'var(--bg-elevated)',
            }}
          >
            {cat}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search run id or article"
          className="ml-auto rounded-md border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-elevated)' }}
        />
      </div>

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--bg-border)' }}>
        <table className="w-full border-collapse text-sm">
          <thead style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <tr className="text-left text-xs" style={{ color: 'var(--text-secondary)' }}>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Run ID</th>
              <th className="px-3 py-2">Cat</th>
              <th className="px-3 py-2">Article</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Tokens</th>
              <th className="px-3 py-2">Durée</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((run) => (
              <tr
                key={`${run.run_id}-${run.run_date}`}
                className="border-t transition duration-100"
                style={{ borderColor: 'var(--bg-border)' }}
              >
                <td className="px-3 py-2">{run.run_date}</td>
                <td className="px-3 py-2">
                  <button
                    className="mono"
                    onClick={async () => {
                      await navigator.clipboard.writeText(run.run_id);
                      onToast('Copied!', 'success');
                    }}
                  >
                    {run.run_id.slice(0, 8)}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <span
                    className="rounded-[5px] px-1.5 py-0.5 text-xs"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[run.active_category] || '#6b7280'}22`,
                      color: CATEGORY_COLORS[run.active_category] || '#6b7280',
                    }}
                  >
                    {run.active_category}
                  </span>
                </td>
                <td className="max-w-[280px] truncate px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                  {run.selected_article?.title || '-'}
                </td>
                <td className="px-3 py-2" style={{ color: scoreColor(run.critique_score || 0) }}>
                  {run.critique_score || 0}/10
                </td>
                <td className="px-3 py-2 mono">{run.total_tokens_used || 0}</td>
                <td className="px-3 py-2 mono">{run.duration_seconds || 0}s</td>
                <td className="px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button onClick={() => onOpenOutputs(run.slug || run.run_id)}>Outputs ↗</button>
                    <button onClick={() => onResume(run.run_id)}>Resume</button>
                    <button
                      onClick={() => onDelete(run.slug || run.run_id)}
                      className="rounded p-1 transition"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 text-xs">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded-md border px-2 py-1 disabled:opacity-40"
        >
          Prev
        </button>
        <span style={{ color: 'var(--text-secondary)' }}>
          {page}/{totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="rounded-md border px-2 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
