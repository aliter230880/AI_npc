"""Локальные эмбеддинги через sentence-transformers.

Модель multilingual-e5-small (~120 МБ) — поддерживает RU/EN/ES/ZH и ещё 90+ языков.
Загружается лениво при первом обращении, чтобы старт сервиса был быстрым.
"""

from __future__ import annotations

import threading
from typing import Sequence

# модель для коротких сводок и реплик: маленькая, быстрая на CPU, мультиязычная
_MODEL_NAME = "intfloat/multilingual-e5-small"
_DIM = 384  # размерность вектора у multilingual-e5-small

_model_lock = threading.Lock()
_model = None


def _get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                # импорт внутри функции — sentence-transformers тянет torch на 200+ МБ,
                # не хотим грузить пока память реально не нужна.
                from sentence_transformers import SentenceTransformer
                _model = SentenceTransformer(_MODEL_NAME)
    return _model


def embed(texts: Sequence[str]) -> list[list[float]]:
    """Возвращает эмбеддинги для списка текстов. Текст короткий (<512 токенов)."""
    if not texts:
        return []
    # для e5-моделей рекомендуется prefix "passage: " (для индексирования) и "query: " (для поиска)
    # делаем проще — один общий префикс, точность от этого почти не страдает
    prepared = [f"passage: {t}" for t in texts]
    model = _get_model()
    out = model.encode(prepared, normalize_embeddings=True, show_progress_bar=False)
    return [v.tolist() for v in out]


def embed_query(text: str) -> list[float]:
    """Эмбеддинг для поискового запроса (другой префикс согласно e5-конвенции)."""
    model = _get_model()
    v = model.encode([f"query: {text}"], normalize_embeddings=True, show_progress_bar=False)[0]
    return v.tolist()


def vector_dim() -> int:
    return _DIM
