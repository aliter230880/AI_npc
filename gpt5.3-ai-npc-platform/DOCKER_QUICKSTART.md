# Docker Quickstart

## 1) Start all services
Run from project root:

`docker compose up --build`

## 2) Open services
- Web app: `http://localhost:8080`
- API health: `http://localhost:8787/health`
- Postgres: `localhost:5432`

## 3) First login
1. Open web app.
2. Use auth block: register with email + password.
3. Login and start chatting with NPC.

## 4) Environment notes
- API in compose uses:
  - `API_KEY=change-me-service-key`
  - `JWT_SECRET=change-me-jwt-secret`
- Frontend build args include the same API key.
- For real TTS set `OPENAI_API_KEY` in `docker-compose.yml` (api service).

## 5) Stop
`docker compose down`

To remove DB volume too:

`docker compose down -v`
