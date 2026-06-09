"""Предзагрузка модели эмбеддингов в кэш. Запускать на сервере один раз."""
import os
os.environ.setdefault("HF_HOME", "/opt/character-platform/data/hf-cache")
os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", "/opt/character-platform/data/hf-cache")
from sentence_transformers import SentenceTransformer
m = SentenceTransformer("intfloat/multilingual-e5-small")
v = m.encode(["passage: hello world"], normalize_embeddings=True)
print("MODEL_READY dim=", len(v[0]))
