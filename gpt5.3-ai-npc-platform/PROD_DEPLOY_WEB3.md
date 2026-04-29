# Production Deploy (web3.aliterra.space)

## 1) DNS prerequisites
- `A web3.aliterra.space -> <server-ip>`
- `A api.web3.aliterra.space -> <server-ip>`

## 2) Server prerequisites
- Docker + Docker Compose plugin installed
- Ports `80` and `443` open

## 3) Prepare env
1. Copy example:

`cp .env.prod.example .env.prod`

2. Edit `.env.prod` and set strong secrets:
- `POSTGRES_PASSWORD`
- `API_KEY`
- `JWT_SECRET`

3. Optional: set `OPENAI_API_KEY` for real TTS chunks.

## 4) Start production stack
Run:

`docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`

Services:
- `caddy` handles TLS and routes domains
- `web` serves frontend
- `api` serves backend
- `postgres` stores data

## 5) Verify
- `https://web3.aliterra.space`
- `https://api.web3.aliterra.space/health`

## 6) Update / restart
- Rebuild and restart:

`docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`

- Stop:

`docker compose --env-file .env.prod -f docker-compose.prod.yml down`
