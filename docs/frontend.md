# Frontend — Control Panel

This document describes the AgenticBlog web control interface.

## Stack

- React 18
- Vite 5
- Tailwind CSS 3
- `@xyflow/react` for the pipeline graph
- `react-markdown` + `remark-gfm` for output rendering
- `lucide-react` for icons

Source code: `frontend/src/`

## Information architecture

The UI is organised around the **lifecycle of a run**. A left sidebar groups the
views into three sections:

- **Run lifecycle** — `Compose` → `Live run` → `Review`
- **Library** — `History`, `Memory`
- **System** — `Settings`

The top bar shows the contextual title plus live run telemetry (run id, tokens,
duration) and the global Stop button while a run is streaming.

## Views

| View | Component | Purpose |
|------|-----------|---------|
| Compose | `components/compose/ComposeView.jsx` | Pick a source mode (Category / Direct URL / Free topic) + language, preview which pipeline stages run, and launch. |
| Live run | `components/live/LiveView.jsx` | Real-time pipeline graph + scored candidates + the multi-persona debate + score trajectory + console. |
| Review | `components/review/ReviewView.jsx` | The 4 outputs (blog/LinkedIn/YouTube/metrics) with an editor, plus a **Provenance** tab that replays curation + debate + injected memory for any past run. |
| History | `components/history/HistoryView.jsx` | Run listing, search, filters, mode badges, resume/delete. |
| Memory | `components/memory/MemoryView.jsx` | Editorial memory: recent-run index, weighted lessons (with decay), per-category topics. |
| Settings | `components/settings/SettingsView.jsx` | Read-only pipeline config: thresholds, models, categories & feeds. |

## Structure

```
frontend/src/
├── App.jsx                       # Shell: sidebar IA + view routing + run lifecycle orchestration
├── lib/
│   └── pipeline.js               # Single source of truth: node→phase→colour, persona colours, helpers
├── components/
│   ├── layout/
│   │   ├── Sidebar.jsx           # Lifecycle navigation
│   │   └── Topbar.jsx            # Contextual title + live telemetry + Stop
│   ├── compose/ComposeView.jsx   # 3 launch modes + language + stage preview
│   ├── live/
│   │   ├── LiveView.jsx          # Composes the live panels
│   │   ├── PipelineGraph.jsx     # @xyflow graph, coloured by pipeline phase
│   │   ├── CandidatesPanel.jsx   # Scored shortlist (+ reasons, kept/cut) + selection breakdown
│   │   ├── DebatePanel.jsx       # SIGNATURE: personas as voices, transcript by round, verdict gauge
│   │   ├── ScoreTrajectory.jsx   # Critique score per iteration vs approval threshold
│   │   └── LogConsole.jsx        # Human log lines (structured data events filtered out)
│   ├── review/
│   │   ├── ReviewView.jsx        # Outputs + editor + provenance
│   │   └── MarkdownPreview.jsx   # Theme-aware markdown renderer
│   ├── memory/MemoryView.jsx
│   ├── settings/SettingsView.jsx
│   ├── history/HistoryView.jsx
│   └── ui/                       # ScoreGauge, ThemeToggle, Toast, ToastProvider, Badge
└── hooks/
    ├── useSSE.js                 # Live pipeline stream (+ structured `data` channel, debate history)
    ├── useRuns.js                # List of runs
    ├── useRun.js                 # Single run details (metadata + 3 outputs)
    ├── useRunState.js            # Full run state for a finished run (candidates, debate, memory)
    ├── useConfig.js              # Categories, languages, thresholds
    ├── useMemory.js              # Editorial memory
    ├── useTheme.js               # Dark/light theme
    └── useToast.js               # Toast notifications
```

## Launch modes (Compose)

`ComposeView` exposes the three pipeline entry points, each mapped to the API:

| Mode | API payload | Pipeline stages |
|------|-------------|-----------------|
| Category | `{ category, lang }` | full pipeline |
| Direct URL | `{ category, lang, url }` | skips scraper / filter / selector |
| Free topic | `{ category, lang, topic }` | skips scraper / filter / selector / fetcher |

The stage-preview strip dims the stages a mode bypasses, mirroring the graph's
`direct_url` / `direct_topic` shortcuts.

## API contract consumed

```
GET    /api/health
GET    /api/config                 # categories, languages, thresholds, models  (Compose, Settings)
GET    /api/runs                   # run list                                    (History, Review rail)
GET    /api/runs/{run_id}          # metadata + blog/linkedin/youtube            (Review)
GET    /api/runs/{run_id}/state    # candidates, debate, iterations, memory      (Review › Provenance)
GET    /api/memory                 # recent runs, topics, weighted lessons       (Memory)
POST   /api/run                    # { category, lang, url?, topic?, resume_id? }
POST   /api/run/stop
GET    /api/run/stream?category=…&resume_id=…   # SSE
PATCH  /api/runs/{run_id}/blog     # save edited blog markdown
DELETE /api/runs/{run_id}
```

## SSE and the structured data channel

The frontend opens an `EventSource` on `/api/run/stream`. Two kinds of event arrive:

- **Log events** — `{ ts, node, status, message, meta }`. Rendered in the console
  and used to drive node status on the graph.
- **Structured data events** — `{ ts, node, status, message, data }`. Agents emit a
  `[NODE] __ACPDATA__ {json}` line on stdout; `api.py` parses it into `event.data`.
  These carry the rich payloads the Live panels render:
  - `filter` → `data.candidates` (scored shortlist with reasons, kept/cut)
  - `selector` → `data.selected` + `data.breakdown` (composite score)
  - `critic` → `data.personas` (rich persona objects), then `data.transcript` + verdict

`useSSE` merges `data` into per-node state (shallow merge, so the personas event and
the later debate event for the critic both survive) and derives `debateHistory` (one
entry per iteration) for the score trajectory. `complete` / `error` close the stream.
The console hides structured events; the panels own them.

In Docker, Nginx disables buffering on `/api/run/stream`. If an LLM call is slow, the
backend emits a periodic heartbeat (`Pipeline running…`) so the stream never looks hung.

## Theme and design system

CSS variables and primitives live in `frontend/src/index.css`.

- **Surfaces / text / accents** — purple, green, red, amber, blue.
- **Pipeline phase colours** — colour encodes the stage: `--phase-curation` (green:
  scraper/filter/selector/fetcher), `--phase-authoring` (purple: writer ⇄ critic),
  `--phase-delivery` (blue: formatter/saver). Shared with the graph and Compose preview.
- **Primitives** — `.panel`, `.panel-raised`, `.btn`/`.btn-primary`/`.btn-danger`,
  `.chip`, `.field`, `.eyebrow`, `.mono`, gauge classes.
- **Animations** — `livePulse`, `slideUp`, `viewEnter`, `shimmer`, `drawFlow`,
  `runPulse`; `prefers-reduced-motion` is respected.

The theme is driven by `data-theme` on `document.documentElement`.

## Run locally

Prerequisites: API on `http://localhost:8000`, Node.js 20+.

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173 (Vite proxies /api → :8000)
```

## Production build

```bash
cd frontend
npm run build      # output in frontend/dist/
npm run preview
```

## Common issues

- `Unknown at rule @tailwind` in the editor — usually a CSS-linter warning, not a Vite
  error. Verify with `npm run build`.
- Frontend loads but Compose/Settings are empty — the backend is down; check
  `http://localhost:8000/api/health` and that `uvicorn api:app …` is running.
- No data in History/Review — check that `output/` contains runs.
- Provenance tab shows "legacy run" — the run predates `run_state.json`; only metadata
  is available for it.
