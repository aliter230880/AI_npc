"""Деплой character-platform на VPS.

Что делает:
1. Создаёт /opt/character-platform на сервере.
2. Заливает backend/ и infra/ через sftp.
3. Если на хосте нет .env — создаёт из .env.example и подставляет JWT_SECRET, OPENROUTER_API_KEY.
4. Собирает docker-образ и запускает контейнер.
5. Дополняет /etc/caddy/Caddyfile блоком ai.aliterra.space (если ещё нет).
6. Перезагружает caddy.

Запускать локально:
    python deploy/deploy.py
"""
from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path

import paramiko

HOST = "168.222.143.103"
USER = "root"
PASS = "ShAVSu2ZM57U7jFB"

REMOTE_ROOT = "/opt/character-platform"
DOMAIN = "ai.aliterra.space"

# Берём ключ из локального .env, чтобы не печатать его в скрипте
LOCAL_ENV = Path(__file__).resolve().parent.parent / "backend" / ".env"


def get_local_env() -> dict[str, str]:
    out: dict[str, str] = {}
    if not LOCAL_ENV.exists():
        return out
    for line in LOCAL_ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip()
    return out


def render_prod_env(api_key: str) -> str:
    """Готовит содержимое /opt/character-platform/infra/.env для прод-окружения."""
    jwt_secret = secrets.token_urlsafe(48)
    return f"""APP_ENV=prod
APP_DEBUG=false

JWT_SECRET={jwt_secret}
JWT_ALGORITHM=HS256
JWT_ACCESS_TTL_MIN=15
JWT_REFRESH_TTL_DAYS=30

DATABASE_URL=sqlite:////data/character_platform.db

OPENROUTER_API_KEY={api_key}
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
LLM_DEFAULT_MODEL=openai/gpt-oss-120b:free
OPENROUTER_HTTP_REFERER=https://{DOMAIN}
OPENROUTER_APP_TITLE=Character Platform

CORS_ORIGINS=https://{DOMAIN}
"""


CADDY_BLOCK = f"""
{DOMAIN} {{
    encode gzip
    reverse_proxy 127.0.0.1:8001
}}
"""


def ssh_connect() -> paramiko.SSHClient:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=20, look_for_keys=False, allow_agent=False)
    return c


def run(c: paramiko.SSHClient, cmd: str, *, check: bool = True, quiet: bool = False) -> str:
    if not quiet:
        print(f"\n$ {cmd}")
    stdin, stdout, stderr = c.exec_command(cmd, timeout=600, get_pty=False)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if not quiet:
        if out.strip():
            print(out.rstrip())
        if err.strip():
            print("[stderr]", err.rstrip())
    if check and code != 0:
        raise RuntimeError(f"command failed (exit {code}): {cmd}")
    return out


def upload_dir(sftp: paramiko.SFTPClient, local: Path, remote: str, *, ignore_names: set[str] | None = None) -> None:
    ignore_names = ignore_names or set()
    if not local.exists():
        return
    try:
        sftp.stat(remote)
    except FileNotFoundError:
        sftp.mkdir(remote)
    for entry in local.iterdir():
        if entry.name in ignore_names:
            continue
        rpath = f"{remote}/{entry.name}"
        if entry.is_dir():
            upload_dir(sftp, entry, rpath, ignore_names=ignore_names)
        else:
            sftp.put(str(entry), rpath)


def main() -> None:
    local_env = get_local_env()
    api_key = local_env.get("OPENROUTER_API_KEY", "")
    if not api_key:
        print("ERROR: backend/.env doesn't have OPENROUTER_API_KEY", file=sys.stderr)
        sys.exit(1)

    print(f"Deploying to {USER}@{HOST}:{REMOTE_ROOT}")
    c = ssh_connect()

    try:
        # 1. Создаём директории
        run(c, f"mkdir -p {REMOTE_ROOT}/backend {REMOTE_ROOT}/infra")

        # 2. SFTP-аплоад backend/ и infra/
        sftp = c.open_sftp()
        try:
            backend_local = Path(__file__).resolve().parent.parent / "backend"
            infra_local = Path(__file__).resolve().parent.parent / "infra"

            print("\nUploading backend/…")
            ignore = {".venv", "__pycache__", "character_platform.db", ".env", "smoke.py", "smoke_real.py", "find_free_model.py"}
            upload_dir(sftp, backend_local, f"{REMOTE_ROOT}/backend", ignore_names=ignore)

            print("Uploading infra/…")
            upload_dir(sftp, infra_local, f"{REMOTE_ROOT}/infra", ignore_names={".env"})

            # 3. .env только если ещё нет (не перетираем секреты на повторных деплоях)
            env_remote = f"{REMOTE_ROOT}/infra/.env"
            try:
                sftp.stat(env_remote)
                print("\n.env already on server, leaving it untouched")
            except FileNotFoundError:
                print("\nWriting fresh /infra/.env on server")
                with sftp.file(env_remote, "w") as f:
                    f.write(render_prod_env(api_key))
                sftp.chmod(env_remote, 0o600)
        finally:
            sftp.close()

        # 4. Собираем образ
        print("\nBuilding docker image…")
        run(c, f"cd {REMOTE_ROOT}/infra && docker compose build")

        # 5. Запускаем
        print("\nStarting container…")
        run(c, f"cd {REMOTE_ROOT}/infra && docker compose up -d")
        run(c, "sleep 3 && docker ps --filter name=character-platform")

        # 6. Health через loopback
        print("\nProbing health on loopback…")
        run(c, "curl -fsS http://127.0.0.1:8001/health || (docker logs --tail 50 character-platform; exit 1)")

        # 7. Caddy: убедиться что блок добавлен один раз
        caddyfile = "/etc/caddy/Caddyfile"
        existing = run(c, f"cat {caddyfile}", quiet=True)
        if DOMAIN not in existing:
            print(f"\nAppending Caddy block for {DOMAIN}")
            # Через base64, чтобы не возиться с экранированием
            import base64
            b64 = base64.b64encode(CADDY_BLOCK.encode("utf-8")).decode("ascii")
            run(c, f"echo {b64} | base64 -d >> {caddyfile}")
            run(c, "caddy validate --config /etc/caddy/Caddyfile")
            run(c, "systemctl reload caddy")
        else:
            print(f"\nCaddyfile already has {DOMAIN} block, skipping")

        print("\n=== DONE ===")
        print(f"Container running: 127.0.0.1:8001")
        print(f"Caddy will serve {DOMAIN} once DNS A-record points here ({HOST}).")
    finally:
        c.close()


if __name__ == "__main__":
    main()
