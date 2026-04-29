# Backend Quickstart

## 1) Setup
1. Copy `backend/.env.example` to `backend/.env`.
2. Fill `JWT_SECRET`.
3. Optionally set `OPENROUTER_API_KEY`, `FASTER_WHISPER_URL`, and TTS adapters (`PIPER_URL`, `XTTS_URL`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`).

## 2) Run backend
From project root:

```bash
node --env-file=backend/.env backend/server.mjs
```

Backend starts on `http://localhost:8787` by default.

## 3) Switch frontend auth to live API
Create `.env` in project root:

```bash
VITE_AUTH_MODE=api
VITE_API_BASE_URL=http://localhost:8787
VITE_RUNTIME_MODE=backend
```

Run frontend as usual:

```bash
npm run dev
```

## 4) Main routes
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/auth/me`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/characters`
- `POST /v1/characters`
- `POST /v1/sessions`
- `GET /v1/sessions/:sessionId/messages`
- `POST /v1/messages`
- `POST /v1/stt`
- `GET /v1/tts/voices`
- `POST /v1/tts/synthesize`
- `POST /v1/tts` (backward-compatible alias)
- `WS /v1/realtime`

## 5) Notes
- Storage is in-memory for this stage, data resets after backend restart.
- `POST /v1/stt` returns `501` until you connect `FASTER_WHISPER_URL`.
- TTS quality path: set `TTS_PROVIDER_DEFAULT` and configure one of providers:
  - `PIPER_URL` for local Piper
  - `XTTS_URL` for local XTTS
  - `OPENAI_API_KEY` for cloud TTS
  - `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` for ElevenLabs