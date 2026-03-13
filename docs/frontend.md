# Frontend — Control Panel

Ce document decrit l'interface web de pilotage d'AgenticBlog.

## Stack

- React 18
- Vite 5
- Tailwind CSS 3
- `react-markdown` pour le rendu des outputs
- `lucide-react` pour les icones

Code source: `frontend/src/`

## Structure

- `frontend/src/App.jsx`: orchestration globale (views, toasts, start/stop run, selection run)
- `frontend/src/components/layout/`: sidebar + topbar
- `frontend/src/components/pipeline/`: graph, drawer, logs live, progression
- `frontend/src/components/outputs/`: rendu markdown, export/copie, metriques
- `frontend/src/components/history/`: filtre, pagination, resume/delete
- `frontend/src/components/ui/`: composants UI reutilisables
- `frontend/src/hooks/useSSE.js`: flux live des evenements pipeline
- `frontend/src/hooks/useRuns.js`: liste des runs
- `frontend/src/hooks/useRun.js`: detail d'un run
- `frontend/src/hooks/useTheme.js`: theme dark/light

## Vues metier

- `Pipeline`: suivi temps reel des noeuds (status + logs)
- `Outputs`: visualisation des fichiers produits par run
- `History`: listing des runs, filtres, actions resume/delete

## Contrat API consomme

Endpoints utilises par le frontend:

- `GET /api/health`
- `GET /api/runs`
- `GET /api/runs/{run_id}`
- `POST /api/run` avec payload `{ "category": "infra", "resume_id": null }`
- `POST /api/run/stop`
- `GET /api/run/stream?category=...&resume_id=...` (SSE)
- `DELETE /api/runs/{run_id}`

## SSE et comportement live

- Le frontend ouvre un `EventSource` sur `/api/run/stream`
- Chaque evenement contient: `ts`, `node`, `status`, `message`, `meta`
- Les statuts `complete` et `error` ferment le stream
- Les logs sont limites cote client pour eviter une croissance infinie
- En Docker, Nginx desactive le buffering sur `/api/run/stream` pour un affichage temps reel
- Si un appel LLM prend du temps, le backend envoie un heartbeat periodique (`Pipeline running...`) pour eviter l'impression de blocage

## Theme et design system

Variables CSS dans `frontend/src/index.css`:

- Couleurs de fond, bordures, textes
- Accents (purple, green, red, amber, blue)
- Animations (`livePulse`, `slideInBottom`, `slideInRight`, `drawFlow`)

Le theme est pilote par `data-theme` sur `document.documentElement`.

## Lancer en local

Prerequis:

- API en cours d'execution sur `http://localhost:8000`
- Node.js 20+

Commandes:

```bash
cd frontend
npm ci
npm run dev
```

Acces: `http://localhost:5173`

## Build production frontend

```bash
cd frontend
npm run build
npm run preview
```

- Build genere dans `frontend/dist/`
- `npm run preview` sert le build localement

## Problemes courants

- `Unknown at rule @tailwind` dans l'editeur:
  - C'est souvent un warning de linter CSS, pas une erreur de build Vite
  - Verifier en priorite avec `npm run build`

- Frontend charge mais API KO:
  - Verifier `http://localhost:8000/api/health`
  - Verifier que le backend est lance via `uvicorn api:app ...`

- Aucune donnee dans History/Outputs:
  - Verifier que le dossier `output/` contient des runs
  - Verifier les permissions d'acces au dossier
