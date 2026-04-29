# Deploy Guide for web3.aliterra.space

## 1) Frontend
- Domain: `https://web3.aliterra.space/`
- Build command: `npm run build`
- Output directory: `dist/`

Set environment variable before build:

`VITE_API_BASE_URL=https://api.web3.aliterra.space/v1`

If backend API key protection is enabled:

`VITE_API_KEY=<same value as backend API_KEY>`

Optional explicit WS endpoint:

`VITE_WS_URL=wss://api.web3.aliterra.space/v1/realtime`

## 2) Backend API
- Suggested domain: `https://api.web3.aliterra.space/`
- Entry file: `backend/server.mjs`
- Health check: `GET /health`

Run API locally:

`PORT=8787 node backend/server.mjs`

Run API with Postgres:

`DATABASE_URL=postgres://user:pass@host:5432/ai_npc PORT=8787 node backend/server.mjs`

Optional SSL for managed Postgres:

`PG_SSL=true`

Enable API key protection:

`API_KEY=<strong-secret>`

Enable JWT auth (required for user login):

`JWT_SECRET=<strong-secret>`

Enable real TTS chunks over WS (OpenAI):

`OPENAI_API_KEY=<key>`

Optional TTS tuning:

`OPENAI_TTS_MODEL=gpt-4o-mini-tts`

`OPENAI_TTS_VOICE=alloy`

## 3) Required routes (already implemented)
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/auth/me`
- `GET /v1/characters`
- `POST /v1/sessions`
- `GET /v1/sessions/:sessionId/messages`
- `POST /v1/messages`
- `WS /v1/realtime`

Realtime payload format:
- Client -> `{ "type": "user_message", "sessionId": "...", "text": "..." }`
- Client (voice mock) -> `{ "type": "user_voice", "sessionId": "...", "transcript": "..." }`
- Server -> `ready | chunk | final | error`

Current server emits additional events:
- `transcript`
- `npc_action`
- `audio_chunk` (real mp3 chunks when OPENAI_API_KEY is set, otherwise mock)

When API key auth is enabled, browser WS uses query auth:
- `wss://api.web3.aliterra.space/v1/realtime?api_key=<API_KEY>`

## 4) DNS / reverse proxy
- `web3.aliterra.space` -> frontend static hosting
- `api.web3.aliterra.space` -> backend process (`node backend/server.mjs`)
- Enable HTTPS certificates for both subdomains.

## 5) Next production steps
- Add API keys/JWT auth for project-level access control.
- Extend `/v1/realtime` to voice events (`audio_chunk`, `transcript`, `npc_action`).
- Add structured logs and metrics export (request latency and error rates).

## 6) Docker stack (ready)
- `Dockerfile.backend`
- `Dockerfile.frontend`
- `docker-compose.yml`
- `docker/nginx/default.conf`

Production files:
- `docker-compose.prod.yml`
- `docker/Caddyfile.prod`
- `.env.prod.example`
- `PROD_DEPLOY_WEB3.md`

Local run:

`docker compose up --build`

Local URLs:
- Frontend: `http://localhost:8080`
- API: `http://localhost:8787`
