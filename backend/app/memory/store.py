"""Клиент Qdrant для хранения и поиска воспоминаний.

Каждое воспоминание — короткая сводка диалога (1-3 предложения), привязанная к
паре (character_id, user_id). При новом сообщении ищем top-k наиболее релевантных
воспоминаний по cosine similarity и подмешиваем в system prompt.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

from qdrant_client import QdrantClient
from qdrant_client.http import models as qm

from app.core.config import get_settings
from app.memory.embedder import embed, embed_query, vector_dim

log = logging.getLogger(__name__)

# Одна общая коллекция для всей памяти; разделение через payload-фильтры.
COLLECTION = "memories"


@dataclass
class Memory:
    text: str
    score: float
    created_at: str | None = None


_client: QdrantClient | None = None


def _get_client() -> QdrantClient:
    global _client
    if _client is None:
        s = get_settings()
        _client = QdrantClient(url=s.qdrant_url, prefer_grpc=False, timeout=10.0)
    return _client


def _ensure_collection() -> None:
    """Создаёт коллекцию если её нет. Идемпотентно."""
    c = _get_client()
    try:
        c.get_collection(COLLECTION)
    except Exception:
        c.create_collection(
            collection_name=COLLECTION,
            vectors_config=qm.VectorParams(size=vector_dim(), distance=qm.Distance.COSINE),
        )
        # индексы по полям, по которым фильтруем — для быстрого поиска
        for field, schema in [
            ("character_id", qm.PayloadSchemaType.KEYWORD),
            ("user_id", qm.PayloadSchemaType.KEYWORD),
        ]:
            try:
                c.create_payload_index(COLLECTION, field_name=field, field_schema=schema)
            except Exception as e:
                log.warning("create_payload_index %s failed: %s", field, e)


def remember(character_id: str, user_id: str | None, text: str) -> str | None:
    """Сохранить одну сводку как воспоминание. Возвращает id записи."""
    text = (text or "").strip()
    if not text:
        return None
    try:
        _ensure_collection()
        vec = embed([text])[0]
        point_id = uuid4().hex
        _get_client().upsert(
            collection_name=COLLECTION,
            points=[
                qm.PointStruct(
                    id=point_id,
                    vector=vec,
                    payload={
                        "text": text,
                        "character_id": character_id,
                        "user_id": user_id or "",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
            ],
        )
        return point_id
    except Exception as e:
        log.exception("remember() failed: %s", e)
        return None


def recall(
    character_id: str,
    user_id: str | None,
    query: str,
    *,
    limit: int = 4,
    min_score: float = 0.55,
) -> list[Memory]:
    """Ищем top-k релевантных воспоминаний для запроса."""
    query = (query or "").strip()
    if not query:
        return []
    try:
        _ensure_collection()
        vec = embed_query(query)
        flt = qm.Filter(
            must=[
                qm.FieldCondition(key="character_id", match=qm.MatchValue(value=character_id)),
                qm.FieldCondition(key="user_id", match=qm.MatchValue(value=user_id or "")),
            ]
        )
        res = _get_client().search(
            collection_name=COLLECTION,
            query_vector=vec,
            query_filter=flt,
            limit=limit,
            score_threshold=min_score,
        )
        return [
            Memory(
                text=str(p.payload.get("text", "")),
                score=float(p.score),
                created_at=p.payload.get("created_at"),
            )
            for p in res
        ]
    except Exception as e:
        log.exception("recall() failed: %s", e)
        return []


def forget_user(user_id: str) -> int:
    """Удалить все воспоминания о юзере (нужно для GDPR/приватности)."""
    try:
        _ensure_collection()
        flt = qm.Filter(must=[qm.FieldCondition(key="user_id", match=qm.MatchValue(value=user_id))])
        res = _get_client().delete(
            collection_name=COLLECTION,
            points_selector=qm.FilterSelector(filter=flt),
        )
        return getattr(res, "operation_id", 0) or 0
    except Exception as e:
        log.exception("forget_user() failed: %s", e)
        return 0
