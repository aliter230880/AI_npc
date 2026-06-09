"""Эндпоинты чата: сессии, сообщения, стриминг ответов."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_optional_user
from app.db import models, schemas
from app.db.session import SessionLocal, get_db
from app.services import chat as chat_service

router = APIRouter(prefix="/chat", tags=["chat"])


def _check_can_chat(char: models.Character, user: models.User | None) -> None:
    if not char.is_public and (not user or char.owner_id != user.id):
        raise HTTPException(status_code=403, detail="Character not accessible")


@router.post("/sessions", response_model=schemas.ConversationRead, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: schemas.ConversationCreate,
    db: Session = Depends(get_db),
    user: models.User | None = Depends(get_optional_user),
) -> models.Conversation:
    char = db.get(models.Character, payload.character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    _check_can_chat(char, user)

    conv = models.Conversation(
        character_id=char.id,
        user_id=user.id if user else None,
        title=payload.title or f"Chat with {char.name}",
    )
    db.add(conv)

    # Авто-приветствие персонажа, если задано
    if char.greeting:
        db.flush()
        chat_service.save_message(db, conv, role="assistant", content=char.greeting, model=char.model)
    db.commit()
    db.refresh(conv)
    return conv


@router.get("/sessions/{session_id}", response_model=schemas.ConversationRead)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: models.User | None = Depends(get_optional_user),
) -> models.Conversation:
    conv = db.get(models.Conversation, session_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Session not found")
    if conv.user_id and (not user or conv.user_id != user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    return conv


@router.get("/sessions/{session_id}/messages", response_model=list[schemas.MessageRead])
def list_messages(
    session_id: str,
    db: Session = Depends(get_db),
    user: models.User | None = Depends(get_optional_user),
) -> list[models.Message]:
    conv = db.get(models.Conversation, session_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Session not found")
    if conv.user_id and (not user or conv.user_id != user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    return list(conv.messages)


@router.post("/sessions/{session_id}/messages", response_model=schemas.ChatResponse)
async def post_message(
    session_id: str,
    payload: schemas.MessageCreate,
    db: Session = Depends(get_db),
    user: models.User | None = Depends(get_optional_user),
) -> schemas.ChatResponse:
    conv = db.get(models.Conversation, session_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Session not found")
    if conv.user_id and (not user or conv.user_id != user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    user_msg, assistant_msg = await chat_service.reply(db, conv, payload.content)
    return schemas.ChatResponse(
        user_message=schemas.MessageRead.model_validate(user_msg),
        assistant_message=schemas.MessageRead.model_validate(assistant_msg),
    )


@router.post("/sessions/{session_id}/stream")
async def stream_message(
    session_id: str,
    payload: schemas.MessageCreate,
    user: models.User | None = Depends(get_optional_user),
):
    """SSE-стрим ответа.

    Возвращает text/event-stream с частями ответа. Каждая дельта приходит
    отдельным SSE-событием `data: <chunk>`. В конце `data: [DONE]`.
    """
    # Здесь не используем Depends(get_db) — у нас своя сессия, чтобы корректно
    # закрыть её после генератора.
    db = SessionLocal()
    conv = db.get(models.Conversation, session_id)
    if not conv:
        db.close()
        raise HTTPException(status_code=404, detail="Session not found")
    if conv.user_id and (not user or conv.user_id != user.id):
        db.close()
        raise HTTPException(status_code=403, detail="Access denied")

    async def event_source():
        try:
            async for piece in chat_service.stream_reply(db, conv, payload.content):
                # SSE-формат: каждая запись начинается с "data: " и заканчивается \n\n
                # Заменяем переводы строк внутри чанка чтобы не сломать формат.
                safe = piece.replace("\n", "\\n")
                yield f"data: {safe}\n\n"
                # давем шанс event loop'у отдать чанк клиенту
                await asyncio.sleep(0)
            yield "data: [DONE]\n\n"
        finally:
            db.close()

    return StreamingResponse(event_source(), media_type="text/event-stream")
