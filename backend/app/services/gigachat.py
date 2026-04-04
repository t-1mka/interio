import httpx
import base64
import json
import uuid
import asyncio
from typing import Optional
from app.config import settings

GIGACHAT_TOKEN_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
GIGACHAT_API_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"

_cached_token: Optional[str] = None
_token_expires_at: float = 0


async def _get_gigachat_token() -> Optional[str]:
    global _cached_token, _token_expires_at
    import time

    if _cached_token and time.time() < _token_expires_at:
        return _cached_token

    if not settings.GIGACHAT_AUTH_KEY:
        return None

    credentials = base64.b64encode(settings.GIGACHAT_AUTH_KEY.encode()).decode()
    headers = {
        "Authorization": f"Basic {credentials}",
        "RqUID": str(uuid.uuid4()),
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = {"scope": settings.GIGACHAT_SCOPE}

    try:
        async with httpx.AsyncClient(verify=False) as client:
            resp = await client.post(GIGACHAT_TOKEN_URL, headers=headers, data=data, timeout=10)
            resp.raise_for_status()
            result = resp.json()
            _cached_token = result.get("access_token")
            _token_expires_at = time.time() + result.get("expires_at", 1800) - 60
            return _cached_token
    except Exception as e:
        print(f"GigaChat token error: {e}")
        return None


async def get_design_tip(step: str, answer: str) -> str:
    """Get a design tip from GigaChat for a quiz step answer."""
    FALLBACK_TIPS = {
        "room": f"Для {answer} важно правильно зонировать пространство и подобрать многофункциональную мебель.",
        "style": f"Стиль {answer} — отличный выбор! Он создаёт уникальную атмосферу и отражает вашу личность.",
        "budget": "Грамотное распределение бюджета — 50% на мебель, 30% на отделку, 20% на декор.",
        "deadline": "Заранее составьте план работ и закажите мебель, чтобы избежать задержек.",
        "colors": f"Выбранная цветовая палитра гармонично впишется в интерьер. Используйте правило 60-30-10.",
        "wishes": "Ваши пожелания помогут дизайнеру создать именно то пространство, о котором вы мечтаете.",
    }

    token = await _get_gigachat_token()
    if not token:
        return FALLBACK_TIPS.get(step, "Отличный выбор! Продолжайте заполнять квиз.")

    prompt = f"""Ты — опытный дизайнер интерьера. Дай короткий практичный совет (2-3 предложения) 
    для клиента, который выбрал: шаг квиза "{step}", ответ: "{answer}". 
    Совет должен быть конкретным и полезным."""

    try:
        async with httpx.AsyncClient(verify=False, timeout=15) as client:
            resp = await client.post(
                GIGACHAT_API_URL,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "model": "GigaChat",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 200,
                    "temperature": 0.7,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"GigaChat tip error: {e}")
        return FALLBACK_TIPS.get(step, "Отличный выбор!")


async def generate_design_description(quiz_data: dict) -> str:
    """Generate a design description based on quiz answers."""
    token = await _get_gigachat_token()

    fallback = (
        f"Проект дизайна интерьера: {quiz_data.get('room', 'помещение')} в стиле "
        f"{quiz_data.get('style', 'современный')}. "
        f"Цветовая гамма: {', '.join(quiz_data.get('colors', ['нейтральные тона']))}. "
        f"Бюджет: {quiz_data.get('budget_min', 0)}–{quiz_data.get('budget_max', 0)} тыс. руб."
    )

    if not token:
        return fallback

    prompt = f"""Создай красивое описание дизайн-проекта интерьера на основе данных:
    - Помещение: {quiz_data.get('room')}
    - Стиль: {quiz_data.get('style')}
    - Бюджет: {quiz_data.get('budget_min')}–{quiz_data.get('budget_max')} тыс. руб.
    - Сроки: {quiz_data.get('deadline')}
    - Цвета: {', '.join(quiz_data.get('colors', []))}
    - Пожелания: {quiz_data.get('wishes', '')}
    
    Описание должно быть вдохновляющим, 3-4 предложения."""

    try:
        async with httpx.AsyncClient(verify=False, timeout=15) as client:
            resp = await client.post(
                GIGACHAT_API_URL,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "model": "GigaChat",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 300,
                    "temperature": 0.8,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"GigaChat description error: {e}")
        return fallback


async def moderate_comment(text: str) -> bool:
    """Returns True if comment is OK, False if spam/toxic."""
    token = await _get_gigachat_token()
    if not token:
        return True  # Allow by default if no API

    prompt = f"""Является ли этот комментарий спамом или содержит оскорбления? 
    Ответь только "ДА" или "НЕТ".
    Комментарий: "{text}" """

    try:
        async with httpx.AsyncClient(verify=False, timeout=10) as client:
            resp = await client.post(
                GIGACHAT_API_URL,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "model": "GigaChat",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 10,
                    "temperature": 0.1,
                },
            )
            resp.raise_for_status()
            answer = resp.json()["choices"][0]["message"]["content"].strip().upper()
            return "НЕТ" in answer  # Not spam
    except Exception:
        return True
