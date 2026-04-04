"""
Роутер для интегра с фронтендом Interio.
Принимает данные квиза из Interio UI и сохраняет в БД СвойСтиль.
"""
import re
import secrets
import random
import string
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models import Application
from app.config import settings

router = APIRouter(prefix="/interio", tags=["interio-frontend"])


def generate_share_link() -> str:
    return secrets.token_urlsafe(12)


def generate_promo_code() -> str:
    prefix = "STYLE"
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"{prefix}-{suffix}"


class InterioQuizSubmit:
    """Модель для данных из Interio фронтенда"""
    def __init__(self, data: dict):
        self.name = data.get("name", "")
        self.phone = data.get("phone", "")
        self.email = data.get("email", "")
        self.room_type = data.get("room_type", "")
        self.zones = data.get("zones", [])
        self.area = data.get("area", 0)
        self.style = data.get("style", "")
        self.budget = data.get("budget", "")
        self.comment = data.get("comment", "")
        self.consent = data.get("consent", False)


@router.post("/quiz/submit")
async def interio_quiz_submit(
    data: dict,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Приём заявки из Interio фронтенда.
    Преобразует данные в формат СвойСтиль и сохраняет в БД.
    """
    quiz = InterioQuizSubmit(data)

    # Валидация
    if not quiz.name or not quiz.phone:
        raise HTTPException(400, "Имя и телефон обязательны")

    # Нормализация телефона
    phone_clean = re.sub(r'[^\d]', '', quiz.phone)
    if len(phone_clean) != 11 or not phone_clean.startswith(('7', '8')):
        raise HTTPException(400, "Некорректный формат телефона")
    normalized_phone = '+' + (phone_clean if phone_clean.startswith('7') else '7' + phone_clean[1:])

    share_link = generate_share_link()
    promo_code = generate_promo_code()

    # Парсинг бюджета для расчёта стоимости
    budget_map = {
        "До 500 000 ₽": (100, 500),
        "500 000 – 1 000 000 ₽": (500, 1000),
        "1 000 000 – 2 000 000 ₽": (1000, 2000),
        "От 2 000 000 ₽": (2000, 5000),
        "Пока не знаю": (0, 0),
    }
    budget_range = budget_map.get(quiz.budget, (0, 0))
    estimated_cost = ((budget_range[0] + budget_range[1]) / 2) * 1000 if budget_range[0] else 0

    # Маппинг комнат из Interio → СвойСтиль
    room_map = {
        "Квартира": "Гостиная",
        "Частный дом": "Гостиная",
        "Офис": "Кабинет",
        "Коммерческое": "Гостиная",
        "Студия": "Спальня",
        "Другое": "Гостиная",
    }

    application = Application(
        share_link=share_link,
        user_id=None,
        room=room_map.get(quiz.room_type, "Гостиная"),
        style=quiz.style if quiz.style else "Современный",
        budget_min=budget_range[0],
        budget_max=budget_range[1],
        deadline="3 месяца",
        colors=[],
        wishes=quiz.comment or "",
        contact_name=quiz.name,
        contact_phone=normalized_phone,
        contact_email=quiz.email or "",
        promo_code=promo_code,
        qr_code_url="",
        design_image_url="",
        estimated_cost=estimated_cost,
        ai_description=f"Проект: {quiz.room_type}, стиль: {quiz.style}. Зоны: {', '.join(quiz.zones) if quiz.zones else 'не указаны'}. Площадь: {quiz.area} м².",
        photos=[],
    )

    db.add(application)
    await db.commit()
    await db.refresh(application)

    return {
        "success": True,
        "submission_id": application.id,
        "share_link": share_link,
        "message": "Заявка успешно сохранена",
    }
