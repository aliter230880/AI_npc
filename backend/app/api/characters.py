"""CRUD для персонажей."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_optional_user
from app.db import models, schemas
from app.db.session import get_db

router = APIRouter(prefix="/characters", tags=["characters"])


@router.get("", response_model=list[schemas.CharacterRead])
def list_characters(
    db: Session = Depends(get_db),
    user: models.User | None = Depends(get_optional_user),
    only_mine: bool = Query(False, description="Только мои персонажи"),
    q: str | None = Query(None, description="Поиск по имени"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[models.Character]:
    query = db.query(models.Character)

    if only_mine:
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required for only_mine")
        query = query.filter(models.Character.owner_id == user.id)
    else:
        # Видим: публичные + свои
        if user:
            query = query.filter(or_(models.Character.is_public == True, models.Character.owner_id == user.id))  # noqa: E712
        else:
            query = query.filter(models.Character.is_public == True)  # noqa: E712

    if q:
        query = query.filter(models.Character.name.ilike(f"%{q}%"))

    return query.order_by(models.Character.created_at.desc()).offset(offset).limit(limit).all()


@router.post("", response_model=schemas.CharacterRead, status_code=status.HTTP_201_CREATED)
def create_character(
    payload: schemas.CharacterCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> models.Character:
    char = models.Character(**payload.model_dump(), owner_id=user.id)
    db.add(char)
    db.commit()
    db.refresh(char)
    return char


@router.get("/{character_id}", response_model=schemas.CharacterRead)
def get_character(
    character_id: str,
    db: Session = Depends(get_db),
    user: models.User | None = Depends(get_optional_user),
) -> models.Character:
    char = db.get(models.Character, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if not char.is_public and (not user or char.owner_id != user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    return char


@router.patch("/{character_id}", response_model=schemas.CharacterRead)
def update_character(
    character_id: str,
    payload: schemas.CharacterUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> models.Character:
    char = db.get(models.Character, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if char.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only owner can update")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(char, k, v)
    db.commit()
    db.refresh(char)
    return char


@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_character(
    character_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> None:
    char = db.get(models.Character, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if char.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only owner can delete")
    db.delete(char)
    db.commit()


@router.post("/{character_id}/forget-me", status_code=status.HTTP_200_OK)
def forget_me(
    character_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> dict:
    """Удалить долговременную память персонажа о текущем юзере.

    Сами сообщения в БД не трогаем — только воспоминания в Qdrant.
    """
    char = db.get(models.Character, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    # доступ: можно «попросить забыть» у любого персонажа с которым общался
    from app.memory import store as memory_store
    n = memory_store.forget_user(user.id)
    return {"ok": True, "operation_id": n}
