from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from app.db import get_db
from app.models import User, Design, Like, Comment, Favorite, Application
from app.schemas import DesignOut, DesignDetail, DesignPublish, DesignUpdate, CommentCreate, CommentOut, LeaderboardEntry, AuthorOut
from app.utils.deps import get_current_user, get_current_user_optional
from app.services.gigachat import moderate_comment

router = APIRouter(prefix="/gallery", tags=["gallery"])


async def _enrich_design(design: Design, current_user: Optional[User], db: AsyncSession) -> dict:
    """Add is_liked, is_favorited flags."""
    is_liked = False
    is_favorited = False
    if current_user:
        like = await db.execute(
            select(Like).where(Like.user_id == current_user.id, Like.design_id == design.id)
        )
        is_liked = like.scalar_one_or_none() is not None
        fav = await db.execute(
            select(Favorite).where(Favorite.user_id == current_user.id, Favorite.design_id == design.id)
        )
        is_favorited = fav.scalar_one_or_none() is not None

    return {
        **{c.name: getattr(design, c.name) for c in design.__table__.columns},
        "author": design.author,
        "is_liked": is_liked,
        "is_favorited": is_favorited,
    }


@router.get("/", response_model=List[DesignOut])
async def list_designs(
    style: Optional[str] = None,
    room: Optional[str] = None,
    budget_min: Optional[int] = None,
    budget_max: Optional[int] = None,
    sort: str = Query("newest", regex="^(newest|popular)$"),
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    query = (
        select(Design)
        .options(selectinload(Design.author))
        .where(Design.is_published == True)
    )

    if style:
        query = query.where(Design.style == style)
    if room:
        query = query.where(Design.room == room)
    if budget_min:
        query = query.where(Design.budget_min >= budget_min)
    if budget_max:
        query = query.where(Design.budget_max <= budget_max)
    if search:
        query = query.where(
            Design.title.ilike(f"%{search}%") | Design.description.ilike(f"%{search}%")
        )

    if sort == "popular":
        query = query.order_by(desc(Design.likes_count))
    else:
        query = query.order_by(desc(Design.created_at))

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    designs = result.scalars().all()

    enriched = []
    for d in designs:
        enriched.append(await _enrich_design(d, current_user, db))
    return enriched


@router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def leaderboard(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            User,
            func.sum(Design.likes_count).label("total_likes"),
            func.count(Design.id).label("designs_count"),
        )
        .join(Design, Design.author_id == User.id)
        .where(Design.is_published == True)
        .group_by(User.id)
        .order_by(desc("total_likes"))
        .limit(20)
    )
    rows = result.all()
    return [
        LeaderboardEntry(
            user=AuthorOut(id=row.User.id, name=row.User.name, avatar_url=row.User.avatar_url),
            total_likes=row.total_likes or 0,
            designs_count=row.designs_count or 0,
            rank=i + 1,
        )
        for i, row in enumerate(rows)
    ]


@router.get("/{design_id}", response_model=DesignDetail)
async def get_design(
    design_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    result = await db.execute(
        select(Design)
        .options(selectinload(Design.author), selectinload(Design.comments).selectinload(Comment.user))
        .where(Design.id == design_id, Design.is_published == True)
    )
    design = result.scalar_one_or_none()
    if not design:
        raise HTTPException(404, "Дизайн не найден")

    # Increment views
    design.views_count += 1
    await db.commit()

    enriched = await _enrich_design(design, current_user, db)
    enriched["comments"] = [c for c in design.comments if c.is_approved]
    return enriched


@router.post("/publish", response_model=DesignOut, status_code=201)
async def publish_design(
    data: DesignPublish,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get application
    result = await db.execute(
        select(Application).where(
            Application.id == data.application_id,
            Application.user_id == current_user.id
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(404, "Заявка не найдена")

    # Check not already published
    existing = await db.execute(
        select(Design).where(Design.application_id == app.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Дизайн уже опубликован")

    design = Design(
        author_id=current_user.id,
        application_id=app.id,
        title=data.title,
        description=data.description,
        main_image_url=app.design_image_url,
        images=[app.design_image_url] if app.design_image_url else [],
        style=app.style,
        room=app.room,
        budget_min=app.budget_min,
        budget_max=app.budget_max,
        colors=app.colors,
        is_published=True,
    )
    db.add(design)
    await db.commit()
    await db.refresh(design)

    # Load author
    result = await db.execute(
        select(Design).options(selectinload(Design.author)).where(Design.id == design.id)
    )
    design = result.scalar_one()
    return await _enrich_design(design, current_user, db)


@router.post("/{design_id}/like")
async def toggle_like(
    design_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Design).where(Design.id == design_id))
    design = result.scalar_one_or_none()
    if not design:
        raise HTTPException(404, "Дизайн не найден")

    like_result = await db.execute(
        select(Like).where(Like.user_id == current_user.id, Like.design_id == design_id)
    )
    existing_like = like_result.scalar_one_or_none()

    if existing_like:
        await db.delete(existing_like)
        design.likes_count = max(0, design.likes_count - 1)
        liked = False
    else:
        db.add(Like(user_id=current_user.id, design_id=design_id))
        design.likes_count += 1
        liked = True

    await db.commit()

    # Notify design author via Telegram
    if liked and design.author_id != current_user.id:
        try:
            from app.services.telegram_notify import notify_like
            author = await db.get(User, design.author_id)
            await notify_like(author, current_user, design)
        except Exception:
            pass

    return {"liked": liked, "likes_count": design.likes_count}


@router.post("/{design_id}/favorite")
async def toggle_favorite(
    design_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fav_result = await db.execute(
        select(Favorite).where(Favorite.user_id == current_user.id, Favorite.design_id == design_id)
    )
    existing = fav_result.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        favorited = False
    else:
        db.add(Favorite(user_id=current_user.id, design_id=design_id))
        favorited = True

    await db.commit()
    return {"favorited": favorited}


@router.post("/{design_id}/comments", response_model=CommentOut, status_code=201)
async def add_comment(
    design_id: int,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Moderate comment via GigaChat
    is_ok = await moderate_comment(data.text)

    result = await db.execute(select(Design).where(Design.id == design_id))
    design = result.scalar_one_or_none()
    if not design:
        raise HTTPException(404, "Дизайн не найден")

    comment = Comment(
        user_id=current_user.id,
        design_id=design_id,
        text=data.text,
        is_approved=is_ok,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    # Load user
    result = await db.execute(
        select(Comment).options(selectinload(Comment.user)).where(Comment.id == comment.id)
    )
    comment = result.scalar_one()

    if not is_ok:
        raise HTTPException(400, "Комментарий не прошёл модерацию")

    return comment
