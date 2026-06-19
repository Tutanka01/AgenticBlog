// Single source of truth for the pipeline's shape, shared by every Live-run view.
// The phase (and its colour) encodes where in the pipeline a node sits — curation,
// authoring, or delivery — so the colour itself carries meaning.

export const PHASES = {
  curation: { label: 'Curation', color: '#22c55e' },
  authoring: { label: 'Authoring', color: '#8b5cf6' },
  delivery: { label: 'Delivery', color: '#3b82f6' },
};

export const NODES = {
  scraper: {
    label: 'scraper', phase: 'curation', order: 0,
    title: 'Scraper', blurb: 'Pulls articles from the category RSS feeds.',
  },
  filter: {
    label: 'filter', phase: 'curation', order: 1,
    title: 'Filter', blurb: 'LLM scores each article; keeps those above threshold.',
  },
  selector: {
    label: 'selector', phase: 'curation', order: 2,
    title: 'Selector', blurb: 'Composite score: relevance + freshness − novelty penalty.',
  },
  fetcher: {
    label: 'fetcher', phase: 'curation', order: 3,
    title: 'Fetcher', blurb: 'Fetches full content: direct → Jina → RSS fallback.',
  },
  writer: {
    label: 'writer', phase: 'authoring', order: 4,
    title: 'Writer', blurb: 'Drafts the article in Mohamad’s voice (min 800 words).',
  },
  critic: {
    label: 'critic', phase: 'authoring', order: 5,
    title: 'Multi-critic', blurb: 'A panel of personas debates the draft, then scores it.',
  },
  formatter: {
    label: 'formatter', phase: 'delivery', order: 6,
    title: 'Formatter', blurb: 'Derives the blog, LinkedIn and YouTube formats.',
  },
  saver: {
    label: 'saver', phase: 'delivery', order: 7,
    title: 'Saver', blurb: 'Writes outputs to disk and updates editorial memory.',
  },
};

export const ORDERED_NODES = Object.keys(NODES).sort((a, b) => NODES[a].order - NODES[b].order);

export function nodeColor(id) {
  const phase = NODES[id]?.phase;
  return PHASES[phase]?.color || '#8b5cf6';
}

export const STATUS_COLOR = {
  idle: '#52525b',
  running: '#8b5cf6',
  done: '#22c55e',
  error: '#ef4444',
};

// Deterministic, distinct colour per debate persona (by index).
export const PERSONA_COLORS = ['#a78bfa', '#22d3ee', '#f59e0b', '#f472b6', '#34d399'];

export function personaColor(i) {
  return PERSONA_COLORS[i % PERSONA_COLORS.length];
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export function scoreColor(score) {
  if (score >= 7) return '#22c55e';
  if (score >= 5) return '#f59e0b';
  return '#ef4444';
}

export const CATEGORY_COLORS = {
  infra: '#22c55e', security: '#ef4444', ai: '#8b5cf6', cloud: '#3b82f6', africa: '#f59e0b',
};

export function categoryColor(id) {
  return CATEGORY_COLORS[id] || '#8b5cf6';
}

export const MODE_META = {
  category: { label: 'Category', color: '#22c55e', glyph: '◇' },
  url: { label: 'Direct URL', color: '#3b82f6', glyph: '↗' },
  topic: { label: 'Free topic', color: '#8b5cf6', glyph: '✦' },
};

// Short, human subtitle for a node card given its live state.
export function subtitleFor(node, state) {
  if (!state) return 'idle';
  const { status, message = '', meta = {}, data = {} } = state;
  if (status === 'idle') return 'waiting';
  if (status === 'error') return message || 'error';

  if (node === 'filter' && data.candidates) return `${data.candidates.filter((c) => c.kept).length} kept · ${data.raw_count} scored`;
  if (node === 'selector' && data.selected) return data.selected.title?.slice(0, 36) || 'selected';
  if (node === 'critic' && data.type === 'debate') return `${data.score}/10 · ${data.approved ? 'approved' : 'revise'}`;
  if (node === 'critic' && data.type === 'personas') return `${data.personas?.length || ''} critics debating…`;

  if (status === 'running') return message || 'running…';

  if (node === 'scraper') return meta.count ? `${meta.count} articles` : message;
  if (node === 'filter') return meta.kept ? `${meta.kept} kept` : message;
  if (node === 'selector') return meta.score ? `score ${meta.score}` : message;
  if (node === 'fetcher') return `${meta.method || 'direct'} · ${meta.chars || 0} chars`;
  if (node === 'writer') return `v${meta.iteration || '?'} · ${meta.words || 0}w`;
  if (node === 'critic') return meta.score ? `${meta.score}/10` : message;
  if (node === 'formatter') return '3 formats';
  if (node === 'saver') return 'saved';
  return message;
}
