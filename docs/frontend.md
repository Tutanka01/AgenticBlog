# Frontend — Control Panel

This document describes the AgenticBlog web control interface.

## Stack

- React 18
- Vite 5
- Tailwind CSS 3
- `react-markdown` for output rendering
- `lucide-react` for icons

Source code: `frontend/src/`

## Structure

- `frontend/src/App.jsx`: global orchestration (views, toasts, start/stop run, run selection)
- `frontend/src/components/layout/`: command bar (category selector, language selector, run button)
- `frontend/src/components/pipeline/`: graph, drawer, live logs, progress
- `frontend/src/components/outputs/`: markdown rendering, export/copy, metrics
- `frontend/src/components/history/`: filter, pagination, resume/delete
- `frontend/src/components/ui/`: reusable UI components
- `frontend/src/hooks/useSSE.js`: live pipeline event stream
- `frontend/src/hooks/useRuns.js`: list of runs
- `frontend/src/hooks/useRun.js`: single run details
- `frontend/src/hooks/useTheme.js`: dark/light theme

## Business views

- `Pipeline`: real-time node tracking (status + logs)
- `Outputs`: visualization of files produced by a run
- `History`: run listing, filters, resume/delete actions

## API contract consumed

Endpoints used by the frontend:

- `GET /api/health`
- `GET /api/runs`
- `GET /api/runs/{run_id}`
- `POST /api/run` with payload `{ "category": "infra", "lang": "fr", "resume_id": null }`
- `POST /api/run/stop`
- `GET /api/run/stream?category=...&resume_id=...` (SSE)
- `DELETE /api/runs/{run_id}`

## SSE and live behavior

- The frontend opens an `EventSource` on `/api/run/stream`
- Each event contains: `ts`, `node`, `status`, `message`, `meta`
- `complete` and `error` statuses close the stream
- Logs are capped client-side to avoid unbounded growth
- In Docker, Nginx disables buffering on `/api/run/stream` for real-time display
- If an LLM call takes time, the backend sends a periodic heartbeat (`Pipeline running...`) to avoid the appearance of hanging

## Theme and design system

CSS variables in `frontend/src/index.css`:

- Background, border, text colors
- Accents (purple, green, red, amber, blue)
- Animations (`livePulse`, `slideInBottom`, `slideInRight`, `drawFlow`)

The theme is driven by `data-theme` on `document.documentElement`.

## Run locally

Prerequisites:

- API running on `http://localhost:8000`
- Node.js 20+

Commands:

```bash
cd frontend
npm ci
npm run dev
```

Access: `http://localhost:5173`

## Production frontend build

```bash
cd frontend
npm run build
npm run preview
```

- Build output in `frontend/dist/`
- `npm run preview` serves the build locally

## Common issues

- `Unknown at rule @tailwind` in the editor:
  - This is usually a CSS linter warning, not a Vite build error
  - Verify first with `npm run build`

- Frontend loads but API is down:
  - Check `http://localhost:8000/api/health`
  - Check that the backend is running via `uvicorn api:app ...`

- No data in History/Outputs:
  - Check that the `output/` directory contains runs
  - Check directory access permissions
