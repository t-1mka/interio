import os
import secrets
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from app.db import get_db
from app.models import User, Application, Design, Favorite
from app.schemas import UserOut, UserUpdate, ApplicationOut, DesignOut
from app.utils.deps import get_current_user
from app.utils.redis_client import get_redis
from app.config import settings
import aiofiles

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/me", response_model=UserOut)
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_profile(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.name is not None:
        current_user.name = data.name
    if data.phone is not None:
        current_user.phone = data.phone
    if data.telegram_id is not None:
        current_user.telegram_id = data.telegram_id

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Только изображения")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"avatar_{current_user.id}_{secrets.token_hex(4)}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    async with aiofiles.open(filepath, "wb") as f:
        content = await file.read()
        await f.write(content)

    current_user.avatar_url = f"{settings.BASE_URL}/uploads/{filename}"
    await db.commit()
    return {"avatar_url": current_user.avatar_url}


@router.get("/applications", response_model=List[ApplicationOut])
async def my_applications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Application)
        .where(Application.user_id == current_user.id)
        .order_by(Application.created_at.desc())
    )
    return result.scalars().all()


@router.get("/designs", response_model=List[DesignOut])
async def my_designs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Design)
        .options(selectinload(Design.author))
        .where(Design.author_id == current_user.id)
        .order_by(Design.created_at.desc())
    )
    designs = result.scalars().all()
    return [
        {**{c.name: getattr(d, c.name) for c in d.__table__.columns}, "author": d.author, "is_liked": False, "is_favorited": False}
        for d in designs
    ]


@router.patch("/designs/{design_id}", response_model=DesignOut)
async def update_design(
    design_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Design).options(selectinload(Design.author))
        .where(Design.id == design_id, Design.author_id == current_user.id)
    )
    design = result.scalar_one_or_none()
    if not design:
        raise HTTPException(404, "Дизайн не найден")

    for field in ["title", "description", "is_published"]:
        if field in data:
            setattr(design, field, data[field])

    await db.commit()
    await db.refresh(design)
    return {**{c.name: getattr(design, c.name) for c in design.__table__.columns}, "author": design.author, "is_liked": False, "is_favorited": False}


@router.delete("/designs/{design_id}")
async def delete_design(
    design_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Design).where(Design.id == design_id, Design.author_id == current_user.id)
    )
    design = result.scalar_one_or_none()
    if not design:
        raise HTTPException(404, "Дизайн не найден")

    await db.delete(design)
    await db.commit()
    return {"message": "Дизайн удалён"}


@router.get("/favorites", response_model=List[DesignOut])
async def my_favorites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Design)
        .options(selectinload(Design.author))
        .join(Favorite, Favorite.design_id == Design.id)
        .where(Favorite.user_id == current_user.id)
        .order_by(Favorite.created_at.desc())
    )
    designs = result.scalars().all()
    return [
        {**{c.name: getattr(d, c.name) for c in d.__table__.columns}, "author": d.author, "is_liked": False, "is_favorited": True}
        for d in designs
    ]


@router.post("/save-draft")
async def save_draft(
    draft: dict,
    current_user: User = Depends(get_current_user),
):
    redis = await get_redis()
    await redis.setex(f"draft:{current_user.id}", 86400, str(draft))
    return {"saved": True}


@router.get("/draft")
async def get_draft(current_user: User = Depends(get_current_user)):
    redis = await get_redis()
    draft = await redis.get(f"draft:{current_user.id}")
    return {"draft": draft}
