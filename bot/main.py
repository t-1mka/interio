"""
Telegram-бот «Интерио» — полноценный квиз внутри Telegram + GigaChat-поддержка.
"""
import asyncio
import logging
import os
import json
from aiohttp import web
import httpx
from aiogram import Bot, Dispatcher, F
from aiogram.types import (
    Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton,
    WebAppInfo,
)
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from dotenv import load_dotenv

from keyboards import (
    main_menu_kb, quiz_rooms_kb, quiz_styles_kb,
    quiz_deadlines_kb, quiz_colors_kb, back_to_start_kb,
    support_kb,
)

load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
API_URL = os.getenv("API_URL", "http://backend:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3002")
GIGACHAT_AUTH_KEY = os.getenv("GIGACHAT_AUTH_KEY", "")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

bot = Bot(token=BOT_TOKEN)
storage = MemoryStorage()
dp = Dispatcher(storage=storage)


# ────────── FSM States ──────────

class QuizState(StatesGroup):
    room = State()
    style = State()
    budget = State()
    deadline = State()
    colors = State()
    wishes = State()
    contact_name = State()
    contact_phone = State()


class SupportState(StatesGroup):
    waiting_message = State()


# ────────── GigaChat Integration ──────────

GIGACHAT_TOKEN_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
GIGACHAT_API_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"

_cached_token: str | None = None
_token_expires_at: float = 0

DESIGN_TOPICS = [
    "дизайн", "интерьер", "ремонт", "стиль", "квартир", "комнат",
    "мебел", "отделк", "планировк", "освещен", "цвет", "материал",
    "бюджет", "стоимост", "площад", "помещен", "кухн", "спальн",
    "гостин", "ванн", "детск", "прихож", "кабинет", "балкон",
    "лофт", "минимализм", "скандинав", "классик", "современн",
    "штор", "пол", "потолок", "стен", "плитк", "ламинат", "паркет",
    "диван", "стол", "стул", "шкаф", "хранен", "декор", "текстил",
    "подушк", "ковёр", "люстр", "светильник", "розетк", "выключател",
    "interior", "design", "renovation", "furniture",
]


async def _get_gigachat_token() -> str | None:
    global _cached_token, _token_expires_at
    import time

    if _cached_token and time.time() < _token_expires_at:
        return _cached_token

    if not GIGACHAT_AUTH_KEY:
        return None

    import base64
    import uuid

    credentials = base64.b64encode(GIGACHAT_AUTH_KEY.encode()).decode()
    headers = {
        "Authorization": f"Basic {credentials}",
        "RqUID": str(uuid.uuid4()),
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = {"scope": "GIGACHAT_API_PERS"}

    try:
        async with httpx.AsyncClient(verify=False) as client:
            resp = await client.post(GIGACHAT_TOKEN_URL, headers=headers, data=data, timeout=10)
            resp.raise_for_status()
            result = resp.json()
            _cached_token = result.get("access_token")
            _token_expires_at = time.time() + result.get("expires_at", 1800) - 60
            return _cached_token
    except Exception as e:
        logger.warning("GigaChat token error: %s", e)
        return None


def _is_design_topic(text: str) -> bool:
    """Проверяет, относится ли вопрос к теме дизайна интерьера."""
    text_lower = text.lower()
    for topic in DESIGN_TOPICS:
        if topic in text_lower:
            return True
    return False


async def ask_gigachat(question: str) -> str:
    """Задаёт вопрос GigaChat с проверкой темы."""
    if not _is_design_topic(question):
        return (
            "🏠 Я помогаю только с вопросами по дизайну интерьера!\n\n"
            "Спросите меня о:\n"
            "• Стилях интерьера\n"
            "• Подборе материалов\n"
            "• Планировке комнат\n"
            "• Цветовых решениях\n"
            "• Бюджете на ремонт"
        )

    token = await _get_gigachat_token()
    if not token:
        return (
            "🤖 GigaChat временно недоступен, но я всё равно помогу!\n\n"
            "Опишите ваши пожелания, и наш дизайнер свяжется с вами."
        )

    prompt = (
        f"Ты — профессиональный дизайнер интерьера. Отвечай кратко (2-4 предложения), "
        f"практично и дружелюбно. Вопрос пользователя: {question}"
    )

    try:
        async with httpx.AsyncClient(verify=False, timeout=15) as client:
            resp = await client.post(
                GIGACHAT_API_URL,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "model": "GigaChat",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 300,
                    "temperature": 0.7,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.error("GigaChat API error: %s", e)
        return (
            "⚠️ Произошла ошибка при обращении к ИИ-помощнику. "
            "Попробуйте позже или задайте вопрос нашему менеджеру."
        )


# ────────── /start ──────────

@dp.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    await message.answer(
        "👋 Добро пожаловать в <b>Интерио</b>!\n\n"
        "🏠 Создайте дизайн-проект мечты за 6 шагов.\n"
        "🤖 ИИ-помощник ответит на ваши вопросы.\n"
        "📄 Получите PDF-бриф и QR-код.",
        reply_markup=main_menu_kb(FRONTEND_URL),
        parse_mode="HTML",
    )


@dp.callback_query(F.data == "back_to_start")
async def back_to_start(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text(
        "🏠 Главное меню <b>Интерио</b>",
        reply_markup=main_menu_kb(FRONTEND_URL),
        parse_mode="HTML",
    )


@dp.callback_query(F.data == "about")
async def about(callback: CallbackQuery):
    await callback.message.edit_text(
        "ℹ️ <b>О Интерио</b>\n\n"
        "Сервис для создания персонального дизайн-проекта интерьера.\n\n"
        "✅ Квиз из 6 шагов\n"
        "🤖 ИИ-поддержка от GigaChat\n"
        "🎨 Генерация дизайна\n"
        "📄 PDF-бриф с проектом\n"
        "🖼 Галерея работ\n\n"
        f"🌐 {FRONTEND_URL}",
        reply_markup=back_to_start_kb(),
        parse_mode="HTML",
    )


# ────────── Quiz Flow (6 шагов внутри Telegram) ──────────

@dp.callback_query(F.data == "quiz_start")
async def quiz_start(callback: CallbackQuery, state: FSMContext):
    await state.set_state(QuizState.room)
    await state.update_data(colors=[])
    await callback.message.edit_text(
        "📍 <b>Шаг 1 из 6 — Помещение</b>\n\n"
        "Какую комнату хотите оформить?",
        reply_markup=quiz_rooms_kb(),
        parse_mode="HTML",
    )


@dp.callback_query(F.data.startswith("quiz_room:"))
async def quiz_room(callback: CallbackQuery, state: FSMContext):
    room = callback.data.split(":")[1]
    await state.update_data(room=room)
    await state.set_state(QuizState.style)
    await callback.message.edit_text(
        f"✅ Помещение: <b>{room}</b>\n\n"
        "🎨 <b>Шаг 2 из 6 — Стиль</b>\n\n"
        "Какой стиль вам нравится?",
        reply_markup=quiz_styles_kb(),
        parse_mode="HTML",
    )


@dp.callback_query(F.data.startswith("quiz_style:"))
async def quiz_style(callback: CallbackQuery, state: FSMContext):
    style = callback.data.split(":")[1]
    await state.update_data(style=style)
    await state.set_state(QuizState.budget)
    await callback.message.edit_text(
        f"✅ Стиль: <b>{style}</b>\n\n"
        "💰 <b>Шаг 3 из 6 — Бюджет</b>\n\n"
        "Напишите бюджет в формате:\n"
        "<code>мин макс</code> (тыс. руб.)\n\n"
        "Пример: <code>200 500</code>",
        parse_mode="HTML",
    )


@dp.message(QuizState.budget)
async def quiz_budget(message: Message, state: FSMContext):
    try:
        parts = message.text.strip().split()
        budget_min, budget_max = int(parts[0]), int(parts[1])
        await state.update_data(budget_min=budget_min, budget_max=budget_max)
        await state.set_state(QuizState.deadline)
        await message.answer(
            f"✅ Бюджет: <b>{budget_min}–{budget_max} тыс. руб.</b>\n\n"
            "⏱ <b>Шаг 4 из 6 — Сроки</b>\n\n"
            "Как быстро нужен результат?",
            reply_markup=quiz_deadlines_kb(),
            parse_mode="HTML",
        )
    except (ValueError, IndexError):
        await message.answer(
            "❌ Введите два числа через пробел, например: <code>200 500</code>",
            parse_mode="HTML",
        )


@dp.callback_query(F.data.startswith("quiz_deadline:"))
async def quiz_deadline(callback: CallbackQuery, state: FSMContext):
    deadline = callback.data.split(":")[1]
    await state.update_data(deadline=deadline)
    await state.set_state(QuizState.colors)
    await callback.message.edit_text(
        f"✅ Срок: <b>{deadline}</b>\n\n"
        "🎨 <b>Шаг 5 из 6 — Цвета</b>\n\n"
        "Выберите цветовую гамму (можно несколько):",
        reply_markup=quiz_colors_kb(),
        parse_mode="HTML",
    )


@dp.callback_query(F.data.startswith("quiz_color:"))
async def quiz_color_select(callback: CallbackQuery, state: FSMContext):
    color = callback.data.split(":")[1]
    data = await state.get_data()
    colors = data.get("colors", [])
    if color not in colors:
        colors.append(color)
    await state.update_data(colors=colors)
    await callback.answer(f"✅ {color} добавлен")


@dp.callback_query(F.data == "quiz_colors_done")
async def quiz_colors_done(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    colors = data.get("colors", [])
    if not colors:
        await callback.answer("Выберите хотя бы один цвет!", show_alert=True)
        return
    await state.set_state(QuizState.wishes)
    await callback.message.edit_text(
        f"✅ Цвета: <b>{', '.join(colors)}</b>\n\n"
        "💭 <b>Шаг 6 из 6 — Пожелания</b>\n\n"
        "Напишите пожелания к дизайну (или отправьте «нет»):",
        parse_mode="HTML",
    )


@dp.message(QuizState.wishes)
async def quiz_wishes(message: Message, state: FSMContext):
    wishes = message.text if message.text.lower() != "нет" else ""
    await state.update_data(wishes=wishes)
    await state.set_state(QuizState.contact_name)
    await message.answer(
        "👤 <b>Финальный шаг — Контакты</b>\n\n"
        "Ваше имя:",
        parse_mode="HTML",
    )


@dp.message(QuizState.contact_name)
async def quiz_contact_name(message: Message, state: FSMContext):
    await state.update_data(contact_name=message.text)
    await state.set_state(QuizState.contact_phone)
    await message.answer("📱 Ваш номер телефона:")


@dp.message(QuizState.contact_phone)
async def quiz_contact_phone(message: Message, state: FSMContext):
    await state.update_data(contact_phone=message.text)
    data = await state.get_data()

    await message.answer("⏳ Создаём ваш дизайн-проект...")

    payload = {
        "room": data.get("room", ""),
        "style": data.get("style", ""),
        "budget_min": data.get("budget_min", 100),
        "budget_max": data.get("budget_max", 300),
        "deadline": data.get("deadline", "3 месяца"),
        "colors": data.get("colors", []),
        "wishes": data.get("wishes", ""),
        "contact_name": data.get("contact_name", ""),
        "contact_phone": data.get("contact_phone", ""),
        "contact_email": "",
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(f"{API_URL}/api/quiz/submit", json=payload)
            resp.raise_for_status()
            result = resp.json()

        share_link = result.get("share_link")
        promo = result.get("promo_code", "")
        cost = result.get("estimated_cost", 0)

        await message.answer(
            f"🎉 <b>Ваш дизайн-проект готов!</b>\n\n"
            f"🏠 {payload['room']} | {payload['style']}\n"
            f"💰 Оценка: {cost:,.0f} руб.\n"
            f"🎁 Промокод: <code>{promo}</code>\n\n"
            f"🔗 Смотреть проект:\n{FRONTEND_URL}/result/{share_link}",
            reply_markup=back_to_start_kb(),
            parse_mode="HTML",
        )
    except Exception as e:
        logger.error("Quiz submit error: %s", e)
        await message.answer(
            "❌ Произошла ошибка. Попробуйте пройти квиз на сайте:\n"
            f"{FRONTEND_URL}/quiz",
            reply_markup=back_to_start_kb(),
        )

    await state.clear()


# ────────── /support — GigaChat ──────────

@dp.message(Command("support"))
@dp.callback_query(F.data == "support")
async def cmd_support(event, state: FSMContext):
    msg = event.message if isinstance(event, CallbackQuery) else event
    if isinstance(event, CallbackQuery):
        await event.answer()
    await state.set_state(SupportState.waiting_message)
    await msg.answer(
        "🤖 <b>ИИ-помощник по дизайну</b>\n\n"
        "Задайте любой вопрос о дизайне интерьера!\n\n"
        "Например:\n"
        "• Какой стиль подойдёт для маленькой кухни?\n"
        "• Как выбрать цветовую гамму для спальни?\n"
        "• Сколько стоит ремонт в новостройке?",
        reply_markup=support_kb(),
        parse_mode="HTML",
    )


@dp.message(SupportState.waiting_message)
async def support_message(message: Message, state: FSMContext):
    # Показываем «думаю...»
    thinking = await message.answer("🤔 Думаю...")

    answer = await ask_gigachat(message.text)

    await thinking.delete()
    await message.answer(
        answer,
        reply_markup=support_kb(),
        parse_mode="HTML" if "<" in answer else None,
    )


# ────────── /my_requests ──────────

@dp.callback_query(F.data == "my_requests")
@dp.message(Command("my_requests"))
async def my_requests(event, state: FSMContext):
    msg = event.message if isinstance(event, CallbackQuery) else event
    if isinstance(event, CallbackQuery):
        await event.answer()
    await msg.answer(
        "📋 Ваши заявки доступны в личном кабинете:\n"
        f"🔗 {FRONTEND_URL}/profile",
        reply_markup=back_to_start_kb(),
    )


# ────────── /quiz shortcut ──────────

@dp.message(Command("quiz"))
async def cmd_quiz(message: Message, state: FSMContext):
    await state.set_state(QuizState.room)
    await state.update_data(colors=[])
    await message.answer(
        "📍 <b>Шаг 1 из 6 — Помещение</b>\n\n"
        "Какую комнату хотите оформить?",
        reply_markup=quiz_rooms_kb(),
        parse_mode="HTML",
    )


# ────────── Unknown commands ──────────

@dp.message()
async def echo_unknown(message: Message):
    await message.answer(
        "🤔 Неизвестная команда. Нажмите /start для меню.",
        reply_markup=main_menu_kb(FRONTEND_URL),
    )


# ────────── Health endpoint (Render) ──────────

async def main():
    logger.info("🤖 Интерио Bot starting...")

    async def health_handler(request):
        return web.Response(
            text=json.dumps({"status": "ok", "bot": "Интерио"}),
            content_type="application/json",
        )

    port = int(os.getenv("PORT", 8080))
    app = web.Application()
    app.router.add_get("/health", health_handler)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logger.info("🌐 Health endpoint on port %d", port)

    await dp.start_polling(bot, skip_updates=True)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Бот остановлен вручную.")
    except Exception as e:
        logger.critical("Fatal error: %s", e)
        exit(1)
