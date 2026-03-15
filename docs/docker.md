# Docker deployment

This document explains how to run AgenticBlog in containers using Docker Compose.

## What gets started

`docker-compose.yml` starts 2 services:

- `backend`:
  - Image built from `Dockerfile.backend`
  - Exposes `8000:8000`
  - Runs `uvicorn api:app --host 0.0.0.0 --port 8000`

- `frontend`:
  - Vite build in a Node image, then static Nginx service
  - Exposes `3000:80`
  - Proxies `/api` to `backend:8000`

## Volumes and persistence

The backend service mounts:

- `./output:/app/output` (run history and generated files)
- `./memory:/app/memory` (SQLite checkpoints)
- `./.env:/app/.env:ro` (LLM configuration, read-only)

Data persists on the host machine between restarts.

## Prerequisites

- Docker Engine + Docker Compose
- A `.env` file at the project root

Minimal example:

```env
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-xxxxxxxx
LLM_MODEL=mistralai/mistral-7b-instruct
```

## Start

From the repo root:

```bash
docker compose up --build
```

Access:

- UI: `http://localhost:3000`
- API: `http://localhost:8000`
- API healthcheck: `http://localhost:8000/api/health`

## Stop

```bash
docker compose down
```

Stop and remove locally built images:

```bash
docker compose down --rmi local
```

## Update after changes

If you modify the backend, frontend, or Dockerfiles:

```bash
docker compose up --build
```

Note: changes to `api.py` and `frontend/nginx.conf` (SSE, heartbeat, buffering) require a rebuild.

If the cache causes side effects:

```bash
docker compose build --no-cache
docker compose up
```

## Quick smoke test

1. Open `http://localhost:3000`
2. Verify the `Pipeline` view loads
3. Launch a run with a category
4. Check live logs and node transitions
5. Verify the `Outputs` and `History` views

## Troubleshooting

- `frontend` starts but no data:
  - Check that `backend` is healthy via `http://localhost:8000/api/health`
  - Read backend logs: `docker compose logs -f backend`

- API key / LLM error:
  - Check the contents of `.env`
  - Restart: `docker compose up --build`

- Port already in use (`3000` or `8000`):
  - Change the mapping in `docker-compose.yml`
  - Or stop the process occupying the port
