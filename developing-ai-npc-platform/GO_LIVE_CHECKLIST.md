# Go Live Checklist (From Preview to Working Production)

## 1) Frontend build and upload
1. Run locally in project root:
`npm.cmd install`
`npm.cmd run build`
2. Upload `dist/index.html` to your hosting root:
`/www/web3.aliterra.space/`

## 2) Backend must be running
Without backend, UI will switch to fallback preview mode.

Required API base:
`https://api.web3.aliterra.space/v1`

Health endpoint must respond:
`https://api.web3.aliterra.space/health`

## 3) Environment variables
Frontend:
- `VITE_API_BASE_URL=https://api.web3.aliterra.space/v1`
- `VITE_WS_URL=wss://api.web3.aliterra.space/v1/realtime`

Backend:
- `DATABASE_URL=...`
- `JWT_SECRET=...`
- `API_KEY=...` (optional but recommended)
- `OPENAI_API_KEY=...` (for real LLM/TTS)

## 4) Runtime status in UI
Hero section now displays runtime mode:
- `Live mode: connected to backend API` -> production working
- `Preview fallback: backend is unreachable...` -> backend not connected

## 5) Fast validation
1. Register/login works.
2. Send a chat message and receive dynamic response.
3. Voice button works with microphone permission.
4. Realtime events appear.
5. Admin NPC save config + clear memory work.
