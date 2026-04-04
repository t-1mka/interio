"""
Interio Telegram Bot — Webhook на Render
Полная интеграция: Mini App, GigaChat AI, рассылки, уведомления
"""
import os
import asyncio
import logging
import httpx
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from aiogram import Bot, Dispatcher, F
from aiogram.types import (
    Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton,
    WebAppInfo
)
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage

# ═══════════════════════════════════════════
# Настройки из .env
# ═══════════════════════════════════════════
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8781630278:AAH4LqIzaQBRY7tOsOZkwbujwMF8r9ySuuQ")
ADMIN_CHAT = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
GIGACHAT_KEY = os.getenv("GIGACHAT_AUTH_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://interio-y5lf.onrender.com")
QUIZ_URL = os.getenv("QUIZ_URL", "https://interio-y5lf.onrender.com/quiz")
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "https://interio-bsw3.onrender.com")

# SMTP для рассылки
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465
SMTP_USER = os.getenv("SMTP_USER", "interiopersonal@gmail.com")
SMTP_PASS = os.getenv("SMTP_PASS", "pcjloityrxwuotht")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())
app = FastAPI()

# ═══════════════════════════════════════════
# FSM States
# ═══════════════════════════════════════════
class QuizState(StatesGroup):
    name = State()
    phone = State()
    room = State()
    style = State()
    budget = State()
    comment = State()

class SupportState(StatesGroup):
    waiting = State()

# ═══════════════════════════════════════════
# Клавиатуры
# ═══════════════════════════════════════════
def main_kb():
    """Главное меню бота"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏠 Пройти квиз", web_app=WebAppInfo(url=QUIZ_URL))],
        [InlineKeyboardButton(text="🤖 ИИ-советник (GigaChat)", callback_data="support")],
        [InlineKeyboardButton(text="📋 Мои заявки", callback_data="my_requests")],
        [InlineKeyboardButton(text="ℹ️ О сервисе", callback_data="about")],
    ])

def back_kb():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Главное меню", callback_data="back")]
    ])

def rooms_kb():
    rooms = ["Квартира", "Частный дом", "Офис", "Коммерческое", "Студия", "Другое"]
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=r, callback_data=f"qr:{r}")] for r in rooms
    ])

def styles_kb():
    s = ["Современный", "Минимализм", "Скандинавский", "Классика", "Лофт", "Неоклассика"]
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=x, callback_data=f"qs:{x}")] for x in s
    ])

def budgets_kb():
    b = ["До 500 000 ₽", "500k – 1M ₽", "1M – 2M ₽", "От 2M ₽", "Пока не знаю"]
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=x, callback_data=f"qb:{x}")] for x in b
    ])

# ═══════════════════════════════════════════
# GigaChat AI
# ═══════════════════════════════════════════
_gc_tok, _gc_exp = None, 0
DESIGN_WORDS = [
    "дизайн", "интерьер", "ремонт", "стиль", "квартир", "комнат", "мебел", "отделк",
    "планировк", "освещен", "цвет", "бюджет", "кухн", "спальн", "гостин", "лофт",
    "минимализм", "скандинав", "классик", "диван", "стол", "шкаф", "декор",
    "interior", "design", "renovation", "furniture", "budget", "room"
]

async def gc_token():
    global _gc_tok, _gc_exp
    import time, uuid
    if _gc_tok and time.time() < _gc_exp:
        return _gc_tok
    if not GIGACHAT_KEY:
        return None
    try:
        async with httpx.AsyncClient(verify=False) as c:
            r = await c.post(
                "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
                headers={"Authorization": f"Basic {GIGACHAT_KEY}", "RqUID": str(uuid.uuid4())},
                data={"scope": "GIGACHAT_API_PERS"}, timeout=10
            )
            d = r.json()
            _gc_tok = d.get("access_token")
            exp = d.get("expires_at", 0)
            _gc_exp = (exp - 60) if exp > 1e9 else (time.time() + 1740)
            return _gc_tok
    except:
        return None

def is_design(text):
    return any(w in text.lower() for w in DESIGN_WORDS)

async def ask_gc(question):
    """Задаёт вопрос GigaChat из бота"""
    if not is_design(question):
        return (
            "🏠 Я помогаю только с вопросами по дизайну интерьера!\n\n"
            "Спросите про:\n"
            "• Стили интерьера\n"
            "• Бюджет на ремонт\n"
            "• Планировку комнат\n"
            "• Подбор материалов\n"
            "• Цветовую гамму"
        )
    tok = await gc_token()
    if not tok:
        return "🤖 ИИ временно недоступен. Попробуйте позже."
    try:
        async with httpx.AsyncClient(verify=False, timeout=20) as c:
            r = await c.post(
                "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {tok}"},
                json={
                    "model": "GigaChat",
                    "messages": [{"role": "user", "content": f"Ты — дизайнер интерьера. Кратко (2-3 предложения): {question}"}],
                    "max_tokens": 300,
                    "temperature": 0.7
                }
            )
            return r.json()["choices"][0]["message"]["content"].strip()
    except:
        return "⚠️ Ошибка ИИ. Попробуйте ещё раз."

# ═══════════════════════════════════════════
# Рассылка по email
# ═══════════════════════════════════════════
async def send_email(subject, body, to_email):
    """Отправка email через Gmail"""
    try:
        import aiosmtplib
        from email.message import EmailMessage
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = SMTP_USER
        msg["To"] = to_email
        msg.set_content(body)
        async with aiosmtplib.SMTP(hostname=SMTP_HOST, port=SMTP_PORT, use_tls=True) as smtp:
            await smtp.login(SMTP_USER, SMTP_PASS)
            await smtp.send_message(msg)
        logging.info(f"Email sent to {to_email}")
    except Exception as e:
        logging.error(f"Email error: {e}")

async def notify_user_about_request(phone, request_data):
    """Уведомляет ТОЛЬКО автора заявки"""
    # Уведомление через бот (если пользователь есть в боте)
    # Через email
    email = request_data.get("email", "")
    if email:
        await send_email(
            subject="Ваша заявка Interio принята!",
            body=(
                f"Здравствуйте, {request_data.get('name', '')}!\n\n"
                f"Ваша заявка принята.\n\n"
                f"Тип помещения: {request_data.get('room_type', '')}\n"
                f"Стиль: {request_data.get('style', '')}\n"
                f"Бюджет: {request_data.get('budget', '')}\n"
                f"Площадь: {request_data.get('area', '')} м²\n\n"
                f"Наш менеджер свяжется с вами в ближайшее время.\n\n"
                f"Результат: {FRONTEND_URL}/result/{request_data.get('share_link', '')}"
            ),
            to_email=email
        )

# ═══════════════════════════════════════════
# Handlers — Главное меню
# ═══════════════════════════════════════════
@dp.message(CommandStart())
async def cmd_start(m: Message, s: FSMContext):
    await s.clear()
    await m.answer(
        f"👋 Добро пожаловать в <b>Interio</b>!\n\n"
        f"🏠 Онлайн-студия дизайна интерьеров\n\n"
        f"• Создайте дизайн-проект за 6 шагов\n"
        f"• ИИ-советник на базе GigaChat\n"
        f"• PDF-бриф с результатом\n"
        f"• Портфолио работ\n\n"
        f"Нажмите «🏠 Пройти квиз» чтобы начать!",
        reply_markup=main_kb(),
        parse_mode="HTML"
    )

@dp.callback_query(F.data == "back")
async def go_back(cb: CallbackQuery, s: FSMContext):
    await s.clear()
    await cb.message.edit_text(
        "🏠 Главное меню <b>Interio</b>\n\nВыберите действие:",
        reply_markup=main_kb(),
        parse_mode="HTML"
    )

@dp.callback_query(F.data == "about")
async def go_about(cb: CallbackQuery):
    await cb.message.edit_text(
        "ℹ️ <b>Interio</b> — онлайн-студия дизайна интерьеров\n\n"
        "• Квиз из 6 шагов\n"
        "• Голосовой ввод ответов\n"
        "• Загрузка фото помещения\n"
        "• ИИ-советник (GigaChat)\n"
        "• PDF-бриф с результатом\n"
        "• QR-код для возврата\n"
        "• Портфолио работ\n\n"
        f"🌐 {FRONTEND_URL}",
        reply_markup=back_kb(),
        parse_mode="HTML"
    )

@dp.callback_query(F.data == "my_requests")
async def my_requests(cb: CallbackQuery):
    """Показывает заявку ТОЛЬКО её автору"""
    # В Telegram нет привязки к phone по умолчанию,
    # поэтому отправляем ссылку на сайт где пользователь видит СВОИ заявки
    await cb.message.edit_text(
        "📋 <b>Мои заявки</b>\n\n"
        "Для просмотра ваших заявок откройте личный кабинет на сайте. "
        "Там вы увидите все ваши заявки и их статусы.",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🌐 Открыть кабинет", web_app=WebAppInfo(url=f"{FRONTEND_URL}/cabinet"))],
            [InlineKeyboardButton(text="🔙 Назад", callback_data="back")]
        ]),
        parse_mode="HTML"
    )

# ═══════════════════════════════════════════
# Handlers — Текстовый квиз в чате
# ═══════════════════════════════════════════
@dp.message(Command("quiz"))
async def cmd_quiz(m: Message, s: FSMContext):
    """Запускает текстовый квиз в чате"""
    await s.clear()
    await s.set_state(QuizState.name)
    await m.answer(
        "👤 <b>Шаг 1/6</b>\n\nВаше имя:",
        parse_mode="HTML"
    )

@dp.message(QuizState.name)
async def quiz_name(m: Message, s: FSMContext):
    await s.update_data(name=m.text)
    await s.set_state(QuizState.phone)
    await m.answer("📱 <b>Шаг 2/6</b>\n\nТелефон (например +79991234567):", parse_mode="HTML")

@dp.message(QuizState.phone)
async def quiz_phone(m: Message, s: FSMContext):
    await s.update_data(phone=m.text)
    await s.set_state(QuizState.room)
    await m.answer("🏠 <b>Шаг 3/6</b>\n\nТип помещения:", reply_markup=rooms_kb(), parse_mode="HTML")

@dp.callback_query(F.data.startswith("qr:"))
async def quiz_room(cb: CallbackQuery, s: FSMContext):
    room = cb.data.split(":", 1)[1]
    await s.update_data(room_type=room)
    await s.set_state(QuizState.style)
    await cb.message.edit_text("🎨 <b>Шаг 4/6</b>\n\nСтиль интерьера:", reply_markup=styles_kb(), parse_mode="HTML")

@dp.callback_query(F.data.startswith("qs:"))
async def quiz_style(cb: CallbackQuery, s: FSMContext):
    style = cb.data.split(":", 1)[1]
    await s.update_data(style=style)
    await s.set_state(QuizState.budget)
    await cb.message.edit_text("💰 <b>Шаг 5/6</b>\n\nБюджет:", reply_markup=budgets_kb(), parse_mode="HTML")

@dp.callback_query(F.data.startswith("qb:"))
async def quiz_budget(cb: CallbackQuery, s: FSMContext):
    budget = cb.data.split(":", 1)[1]
    await s.update_data(budget=budget)
    await s.set_state(QuizState.comment)
    await cb.message.edit_text("💬 <b>Шаг 6/6</b>\n\nКомментарий (или «нет»):", parse_mode="HTML")

@dp.message(QuizState.comment)
async def quiz_comment(m: Message, s: FSMContext):
    d = await s.get_data()
    comment = m.text if m.text.lower() != "нет" else ""
    name = d.get("name", "")
    phone = d.get("phone", "")
    style = d.get("style", "")
    budget = d.get("budget", "")
    room = d.get("room_type", "")

    # Уведомление ТОЛЬКО автору заявки
    await notify_user_about_request(phone, {
        "name": name,
        "email": "",
        "room_type": room,
        "style": style,
        "budget": budget,
        "area": 60,
        "share_link": ""
    })

    await m.answer(
        f"🎉 <b>Заявка отправлена!</b>\n\n"
        f"🏠 {room} | {style}\n"
        f"💰 {budget}\n\n"
        f"Мы свяжемся с вами в ближайшее время!",
        reply_markup=main_kb(),
        parse_mode="HTML"
    )
    await s.clear()

# ═══════════════════════════════════════════
# Handlers — GigaChat ИИ-советник
# ═══════════════════════════════════════════
@dp.message(Command("support"))
@dp.callback_query(F.data == "support")
async def cmd_support(ev, s: FSMContext):
    msg = ev.message if hasattr(ev, 'message') else ev
    if hasattr(ev, 'answer'):
        await ev.answer()
    await s.set_state(SupportState.waiting)
    await msg.answer(
        "🤖 <b>ИИ-советник GigaChat</b>\n\n"
        "Задайте вопрос о дизайне интерьера!\n\n"
        "Примеры:\n"
        "• Какой стиль для маленькой кухни?\n"
        "• Как выбрать цветовую гамму?\n"
        "• Какой бюджет на ремонт 60м²?",
        reply_markup=back_kb(),
        parse_mode="HTML"
    )

@dp.message(SupportState.waiting)
async def support_msg(m: Message, s: FSMContext):
    thinking = await m.answer("🤔 Думаю...")
    answer = await ask_gc(m.text)
    await thinking.delete()
    await m.answer(answer, reply_markup=back_kb())

# ═══════════════════════════════════════════
# Unknown commands
# ═══════════════════════════════════════════
@dp.message()
async def unknown(m: Message):
    await m.answer("🤔 Введите /start для меню", reply_markup=main_kb())

# ═══════════════════════════════════════════
# FastAPI — Webhook + Health
# ═══════════════════════════════════════════
@app.on_event("startup")
async def startup():
    if BOT_TOKEN:
        webhook = f"{WEBHOOK_URL}/tg-webhook"
        try:
            await bot.set_webhook(webhook)
            logging.info(f"Webhook set to {webhook}")
        except:
            logging.info("Webhook failed, starting polling...")
            asyncio.create_task(dp.start_polling(bot, skip_updates=True))

@app.post("/tg-webhook")
async def webhook(req: Request):
    data = await req.json()
    await dp.feed_webhook_update(bot, data)
    return JSONResponse({"ok": True})

@app.get("/health")
async def health():
    return {"status": "ok", "bot": "Interio", "frontend": FRONTEND_URL}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
