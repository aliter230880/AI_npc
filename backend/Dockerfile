# Простой Dockerfile для FastAPI бэкенда.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Системные зависимости минимальны — bcrypt и cryptography у нас уже идут wheel-ами,
# но gcc может пригодиться для каких-то будущих пакетов.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

# Хранилище SQLite будет в /data — на хосте смонтируем volume.
RUN mkdir -p /data
ENV DATABASE_URL=sqlite:////data/character_platform.db

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
