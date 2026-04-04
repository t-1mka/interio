import os
import secrets
import random
import string
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from app.db import get_db
from app.models import User, Application
from app.schemas import QuizSubmit, ApplicationOut
from app.utils.deps import get_current_user_optional
from app.utils.redis_client import get_redis
from app.services import gigachat, kandinsky, qrcode_service, pdf
from app.config import settings
import json
import aiofiles

router = APIRouter(prefix="/quiz", tags=["quiz"])

COST_COEFFICIENTS = {
    "room": {
        "Гостиная": 1.2,
        "Спальня": 1.0,
        "Кухня": 1.5,
        "Ванная": 1.3,
        "Детская": 1.1,
        "Кабинет": 0.9,
        "Прихожая": 0.8,
    },
    "style": {
        "Современный": 1.0,
        "Минимализм": 0.9,
        "Скандинавский": 1.0,
        "Классический": 1.6,
        "Лофт": 1.1,
        "Японский": 1.2,
        "Арт-деко": 1.5,
    },
    "deadline": {
        "1 месяц": 1.3,
        "3 месяца": 1.0,
        "6 месяцев": 0.9,
        "Без срока": 0.8,
    },
}

BASE_COST_PER_SQM = 5000  # rub per sqm


def calculate_cost(quiz_data: dict) -> float:
    budget_mid = (quiz_data.get("budget_min", 0) + quiz_data.get("budget_max", 0)) / 2
    room_coeff = COST_COEFFICIENTS["room"].get(quiz_data.get("room", ""), 1.0)
    style_coeff = COST_COEFFICIENTS["style"].get(quiz_data.get("style", ""), 1.0)
    deadline_coeff = COST_COEFFICIENTS["deadline"].get(quiz_data.get("deadline", ""), 1.0)
    estimated = budget_mid * 1000 * room_coeff * style_coeff * deadline_coeff
    return round(estimated, -2)


def generate_promo_code() -> str:
    prefix = "STYLE"
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"{prefix}-{suffix}"


def generate_share_link() -> str:
    return secrets.token_urlsafe(12)


@router.get("/tip")
async def get_tip(step: str, answer: str):
    """Get AI design tip for a quiz step answer. Cached in Redis."""
    redis = await get_redis()
    cache_key = f"tip:{step}:{answer[:50]}"

    cached = await redis.get(cache_key)
    if cached:
        return {"tip": cached}

    tip = await gigachat.get_design_tip(step, answer)
    await redis.setex(cache_key, 3600, tip)
    return {"tip": tip}


@router.post("/upload-photo")
async def upload_photo(file: UploadFile = File(...)):
    """Upload a room photo."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Только изображения")

    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(400, "Файл слишком большой (макс 10MB)")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"room_{secrets.token_hex(8)}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    async with aiofiles.open(filepath, "wb") as f:
        content = await file.read()
        await f.write(content)

    return {"url": f"{settings.BASE_URL}/uploads/{filename}"}


@router.post("/speech-recognize")
async def speech_recognize(audio: UploadFile = File(...)):
    """Recognize speech via SaluteSpeech."""
    from app.services.salutespeech import recognize_speech
    content = await audio.read()
    text = await recognize_speech(content, audio_format="wav")
    return {"text": text}


@router.post("/submit", response_model=ApplicationOut, status_code=201)
async def submit_quiz(
    data: QuizSubmit,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Submit quiz answers and generate design."""
    share_link = generate_share_link()
    promo_code = generate_promo_code()
    estimated_cost = calculate_cost(data.dict())

    # Generate QR code (sync, fast)
    qr_url = qrcode_service.generate_qr_code(share_link)

    # Generate AI description
    ai_description = await gigachat.generate_design_description(data.dict())

    # Generate design image
    design_prompt = f"{data.room}, {data.style} style, {', '.join(data.colors)}, {data.wishes}"
    design_image_url = await kandinsky.generate_design_image(design_prompt, data.style)

    # Create application record
    application = Application(
        share_link=share_link,
        user_id=current_user.id if current_user else None,
        room=data.room,
        style=data.style,
        budget_min=data.budget_min,
        budget_max=data.budget_max,
        deadline=data.deadline,
        colors=data.colors,
        wishes=data.wishes,
        contact_name=data.contact_name,
        contact_phone=data.contact_phone,
        contact_email=data.contact_email,
        promo_code=promo_code,
        qr_code_url=qr_url,
        design_image_url=design_image_url,
        estimated_cost=estimated_cost,
        ai_description=ai_description,
        photos=[],
    )

    db.add(application)
    await db.commit()
    await db.refresh(application)

    # Generate PDF in background
    background_tasks.add_task(_generate_pdf_and_notify, application.id, db)

    return application


async def _generate_pdf_and_notify(app_id: int, db: AsyncSession):
    """Generate PDF and send Telegram notification."""
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.db import AsyncSessionLocal
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Application).where(Application.id == app_id))
        application = result.scalar_one_or_none()
        if not application:
            return

        try:
            pdf_url = pdf.generate_pdf(application)
            application.pdf_url = pdf_url
            await session.commit()
        except Exception as e:
            print(f"PDF generation error: {e}")

        # Telegram notification
        try:
            from app.services.telegram_notify import notify_admin_new_application
            await notify_admin_new_application(application)
        except Exception as e:
            print(f"Telegram notify error: {e}")


@router.get("/result/{share_link}", response_model=ApplicationOut)
async def get_result(share_link: str, db: AsyncSession = Depends(get_db)):
    """Get application by share link."""
    result = await db.execute(
        select(Application).where(Application.share_link == share_link)
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(404, "Заявка не найдена")
    return application
