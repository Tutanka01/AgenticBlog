# Deploiement Docker

Ce document explique comment lancer AgenticBlog en conteneurs avec Docker Compose.

## Ce qui est lance

`docker-compose.yml` demarre 2 services:

- `backend`:
  - Image construite depuis `Dockerfile.backend`
  - Expose `8000:8000`
  - Lance `uvicorn api:app --host 0.0.0.0 --port 8000`

- `frontend`:
  - Build Vite dans une image Node, puis service statique Nginx
  - Expose `3000:80`
  - Proxy `/api` vers `backend:8000`

## Volumes et persistance

Le service backend monte:

- `./output:/app/output` (historique des runs et fichiers generes)
- `./memory:/app/memory` (checkpoints SQLite)
- `./.env:/app/.env:ro` (configuration LLM en lecture seule)

Consequence: les donnees restent sur la machine hote entre deux redemarrages.

## Prerequis

- Docker Engine + Docker Compose
- Fichier `.env` present a la racine du projet

Exemple minimal:

```env
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-xxxxxxxx
LLM_MODEL=mistralai/mistral-7b-instruct
```

## Lancement

Depuis la racine du repo:

```bash
docker compose up --build
```

Acces:

- UI: `http://localhost:3000`
- API: `http://localhost:8000`
- Healthcheck API: `http://localhost:8000/api/health`

## Arret

```bash
docker compose down
```

Arret + suppression des images creees localement:

```bash
docker compose down --rmi local
```

## Mise a jour apres changements

- Si tu modifies le backend, le frontend ou les Dockerfiles:

```bash
docker compose up --build
```

Important: les changements sur `api.py` et `frontend/nginx.conf` (SSE, heartbeat, buffering) necessitent un rebuild.

- Si le cache cree des effets de bord:

```bash
docker compose build --no-cache
docker compose up
```

## Verification rapide (smoke test)

1. Ouvrir `http://localhost:3000`
2. Verifier que la vue `Pipeline` s'affiche
3. Lancer un run avec une categorie
4. Verifier les logs live et les transitions de noeuds
5. Verifier les vues `Outputs` et `History`

## Depannage

- `frontend` demarre mais pas de donnees:
  - Verifier que `backend` est `healthy` via `http://localhost:8000/api/health`
  - Lire les logs backend: `docker compose logs -f backend`

- Erreur API key / LLM:
  - Verifier le contenu de `.env`
  - Redemarrer: `docker compose up --build`

- Port deja pris (`3000` ou `8000`):
  - Changer le mapping dans `docker-compose.yml`
  - Ou arreter le processus qui occupe le port
