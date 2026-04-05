"""
Interio Telegram Bot — Webhook на Render
Полная интеграция: Mini App, GigaChat AI, уведомления
Система ролей: менеджер получает заявки, заказчик — нет
"""
import os
import asyncio
import logging
import json
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
GIGACHAT_KEY = os.getenv("GIGACHAT_AUTH_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://interio-y5lf.onrender.com")
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "https://interio-bsw3.onrender.com")

# Путь к файлу с пользователями (JSON)
USERS_FILE = os.path.join(os.path.dirname(__file__), "data", "bot_users.json")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())
app = FastAPI()

# ═══════════════════════════════════════════
# Хранилище пользователей (ролей)
# ═══════════════════════════════════════════
def _ensure_dir():
    os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)

def load_users():
    _ensure_dir()
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_users(users: dict):
    _ensure_dir()
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def get_user_role(tg_id: int) -> str | None:
    users = load_users()
    return str(users.get(str(tg_id), {}).get("role"))

def set_user_role(tg_id: int, name: str, phone: str, role: str):
    users = load_users()
    users[str(tg_id)] = {
        "name": name,
        "phone": phone,
        "role": role,
        "tg_id": tg_id,
    }
    save_users(users)

def get_managers() -> list[int]:
    """Возвращает список telegram_id всех менеджеров"""
    users = load_users()
    return [int(uid) for uid, u in users.items() if u.get("role") == "manager"]

def get_user_by_phone(phone: str) -> dict | None:
    """Найти пользователя по телефону"""
    users = load_users()
    for uid, u in users.items():
        if u.get("phone") == phone:
            return {"tg_id": int(uid), **u}
    return None

# ═══════════════════════════════════════════
# FSM States
# ═══════════════════════════════════════════
class RegisterState(StatesGroup):
    choosing_role = State()
    entering_name = State()
    entering_phone = State()

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
def role_selection_kb():
    """Клавиатура выбора роли при первой регистрации"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="👔 Менеджер", callback_data="role:manager")],
        [InlineKeyboardButton(text="🛒 Заказчик", callback_data="role:customer")],
    ])

def main_kb_manager():
    """Главное меню для менеджера"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏠 Пройти квиз", web_app=WebAppInfo(url=FRONTEND_URL))],
        [InlineKeyboardButton(text="📊 Мои заявки", callback_data="my_requests")],
        [InlineKeyboardButton(text="🤖 ИИ-советник (GigaChat)", callback_data="support")],
        [InlineKeyboardButton(text="ℹ️ О сервисе", callback_data="about")],
        [InlineKeyboardButton(text="👥 Команда", callback_data="team")],
    ])

def main_kb_customer():
    """Главное меню для заказчика"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏠 Пройти квиз", web_app=WebAppInfo(url=FRONTEND_URL))],
        [InlineKeyboardButton(text="🤖 ИИ-советник (GigaChat)", callback_data="support")],
        [InlineKeyboardButton(text="📋 Мои заявки", callback_data="my_requests")],
        [InlineKeyboardButton(text="ℹ️ О сервисе", callback_data="about")],
    ])

def main_kb(role: str | None = None):
    """Главное меню в зависимости от роли"""
    if role == "manager":
        return main_kb_manager()
    return main_kb_customer()

def back_kb(role: str | None = None):
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
        async with httpx.AsyncClient(verify=False, timeout=30) as c:
            r = await c.post(
                "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {tok}"},
                json={
                    "model": "GigaChat",
                    "messages": [{"role": "user", "content": f"Ты — дизайнер интерьера. Кратко (2-3 предложения): {question}"}],
                    "max_tokens": 400,
                    "temperature": 0.7
                }
            )
            return r.json()["choices"][0]["message"]["content"].strip()
    except:
        return "⚠️ Ошибка ИИ. Попробуйте ещё раз."

# ═══════════════════════════════════════════
# Отправка уведомлений менеджерам
# ═══════════════════════════════════════════
async def notify_managers(text: str):
    """Отправить уведомление всем менеджерам"""
    managers = get_managers()
    if not managers:
        logging.info("Нет менеджеров для уведомления")
        return
    for mgr_id in managers:
        try:
            await bot.send_message(mgr_id, text, parse_mode="HTML")
            logging.info(f"Уведомление отправлено менеджеру {mgr_id}")
        except Exception as e:
            logging.error(f"Ошибка отправки менеджеру {mgr_id}: {e}")

# ═══════════════════════════════════════════
# Handlers — Регистрация
# ═══════════════════════════════════════════
@dp.message(CommandStart())
async def cmd_start(m: Message, s: FSMContext):
    await s.clear()
    tg_id = m.from_user.id
    role = get_user_role(tg_id)
    
    if role:
        # Пользователь уже зарегистрирован
        role_name = "👔 Менеджер" if role == "manager" else "🛒 Заказчик"
        await m.answer(
            f"👋 С возвращением, <b>{m.from_user.full_name}</b>!\n\n"
            f"Ваша роль: {role_name}\n\n"
            f"🏠 Онлайн-студия дизайна интерьеров\n\n"
            f"• Создайте дизайн-проект за 6 шагов\n"
            f"• ИИ-советник на базе GigaChat\n"
            f"• Портфолио работ\n\n"
            f"🌐 {FRONTEND_URL}",
            reply_markup=main_kb(role),
            parse_mode="HTML"
        )
    else:
        # Новый пользователь — предлагаем выбрать роль
        await m.answer(
            f"👋 Добро пожаловать в <b>Interio</b>!\n\n"
            f"🏠 Онлайн-студия дизайна интерьеров\n\n"
            f"Для начала выберите вашу роль:",
            reply_markup=role_selection_kb(),
            parse_mode="HTML"
        )

@dp.callback_query(F.data.startswith("role:"))
async def role_selected(cb: CallbackQuery, s: FSMContext):
    role = cb.data.split(":", 1)[1]
    await s.update_data(chosen_role=role)
    
    role_name = "👔 Менеджер" if role == "manager" else "🛒 Заказчик"
    await cb.message.edit_text(
        f"Вы выбрали: <b>{role_name}</b>\n\n"
        f"Теперь введите ваше имя:",
        parse_mode="HTML"
    )
    await s.set_state(RegisterState.entering_name)

@dp.message(RegisterState.entering_name)
async def reg_name(m: Message, s: FSMContext):
    await s.update_data(name=m.text.strip())
    await s.set_state(RegisterState.entering_phone)
    await m.answer(
        "📱 Введите ваш номер телефона\n"
        f"(например <code>+79991234567</code>):",
        parse_mode="HTML"
    )

@dp.message(RegisterState.entering_phone)
async def reg_phone(m: Message, s: FSMContext):
    phone = m.text.strip()
    # Простая валидация
    clean = "".join(c for c in phone if c.isdigit())
    if len(clean) < 10:
        await m.answer("❌ Введите корректный номер телефона:")
        return
    
    data = await s.get_data()
    name = data.get("name", m.from_user.full_name)
    role = data.get("chosen_role", "customer")
    
    # Сохраняем пользователя
    set_user_role(m.from_user.id, name, phone, role)
    
    role_name = "👔 Менеджер" if role == "manager" else "🛒 Заказчик"
    
    if role == "manager":
        await m.answer(
            f"✅ <b>Регистрация завершена!</b>\n\n"
            f"Роль: {role_name}\n"
            f"Имя: {name}\n"
            f"Телефон: {phone}\n\n"
            f"📊 Вы будете получать уведомления о новых заявках.",
            reply_markup=main_kb(role),
            parse_mode="HTML"
        )
    else:
        await m.answer(
            f"✅ <b>Регистрация завершена!</b>\n\n"
            f"Роль: {role_name}\n"
            f"Имя: {name}\n"
            f"Телефон: {phone}\n\n"
            f"🌐 Теперь вы можете создать дизайн-проект!",
            reply_markup=main_kb(role),
            parse_mode="HTML"
        )
    await s.clear()

# ═══════════════════════════════════════════
# Handlers — Главное меню
# ═══════════════════════════════════════════
@dp.callback_query(F.data == "back")
async def go_back(cb: CallbackQuery, s: FSMContext):
    await s.clear()
    role = get_user_role(cb.from_user.id)
    await cb.message.edit_text(
        "🏠 Главное меню <b>Interio</b>\n\nВыберите действие:",
        reply_markup=main_kb(role),
        parse_mode="HTML"
    )

@dp.callback_query(F.data == "about")
async def go_about(cb: CallbackQuery):
    role = get_user_role(cb.from_user.id)
    await cb.message.edit_text(
        "ℹ️ <b>Interio</b> — онлайн-студия дизайна интерьеров\n\n"
        "• Квиз из 6 шагов\n"
        "• Голосовой ввод ответов\n"
        "• Загрузка фото помещения\n"
        "• ИИ-советник (GigaChat)\n"
        "• Портфолио работ\n\n"
        f"🌐 {FRONTEND_URL}",
        reply_markup=back_kb(role),
        parse_mode="HTML"
    )

@dp.callback_query(F.data == "team")
async def team_info(cb: CallbackQuery):
    """Показать информацию о команде (только для менеджеров)"""
    role = get_user_role(cb.from_user.id)
    if role != "manager":
        await cb.answer("Доступно только для менеджеров", show_alert=True)
        return
    
    users = load_users()
    managers = [u for u in users.values() if u.get("role") == "manager"]
    customers = [u for u in users.values() if u.get("role") == "customer"]
    
    text = f"👥 <b>Команда Interio</b>\n\n"
    text += f"👔 Менеджеры: {len(managers)}\n"
    for m in managers:
        text += f"  • {m.get('name', '?')} ({m.get('phone', '?')})\n"
    text += f"\n🛒 Заказчики: {len(customers)}\n"
    for c in customers:
        text += f"  • {c.get('name', '?')}\n"
    
    await cb.message.edit_text(text, reply_markup=back_kb(role), parse_mode="HTML")

@dp.callback_query(F.data == "my_requests")
async def my_requests(cb: CallbackQuery):
    role = get_user_role(cb.from_user.id)
    await cb.message.edit_text(
        "📋 <b>Мои заявки</b>\n\n"
        "Для просмотра ваших заявок откройте сайт:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🌐 Открыть сайт", web_app=WebAppInfo(url=FRONTEND_URL))],
            [InlineKeyboardButton(text="🔙 Назад", callback_data="back")]
        ]),
        parse_mode="HTML"
    )

# ═══════════════════════════════════════════
# Handlers — Текстовый квиз
# ═══════════════════════════════════════════
@dp.message(Command("quiz"))
async def cmd_quiz(m: Message, s: FSMContext):
    await s.clear()
    await s.set_state(QuizState.name)
    await m.answer("👤 <b>Шаг 1/6</b>\n\nВаше имя:", parse_mode="HTML")

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

    txt = (
        f"🆕 <b>Новая заявка!</b>\n\n"
        f"👤 {name}\n📱 {phone}\n🎨 {style}\n💰 {budget}\n🏢 {room}\n"
        f"💬 {comment or '—'}"
    )
    
    # Уведомление ТОЛЬКО менеджерам
    await notify_managers(txt)

    await m.answer(
        f"🎉 <b>Заявка отправлена!</b>\n\n"
        f"🏠 {room} | {style}\n"
        f"💰 {budget}\n\n"
        f"Мы свяжемся с вами в ближайшее время!",
        reply_markup=main_kb(get_user_role(m.from_user.id)),
        parse_mode="HTML"
    )
    await s.clear()

# ═══════════════════════════════════════════
# Handlers — GigaChat
# ═══════════════════════════════════════════
@dp.message(Command("support"))
@dp.callback_query(F.data == "support")
async def cmd_support(ev, s: FSMContext):
    msg = ev.message if hasattr(ev, 'message') else ev
    if hasattr(ev, 'answer'): await ev.answer()
    await s.set_state(SupportState.waiting)
    role = get_user_role(ev.from_user.id) if hasattr(ev, 'from_user') else None
    await msg.answer(
        "🤖 <b>ИИ-советник GigaChat</b>\n\n"
        "Задайте вопрос о дизайне интерьера!\n\n"
        "Примеры:\n"
        "• Какой стиль для маленькой кухни?\n"
        "• Как выбрать цветовую гамму?\n"
        "• Какой бюджет на ремонт 60м²?",
        reply_markup=back_kb(role),
        parse_mode="HTML"
    )

@dp.message(SupportState.waiting)
async def support_msg(m: Message, s: FSMContext):
    thinking = await m.answer("🤔 Думаю...")
    answer = await ask_gc(m.text)
    await thinking.delete()
    role = get_user_role(m.from_user.id)
    await m.answer(answer, reply_markup=back_kb(role))

@dp.message()
async def unknown(m: Message):
    role = get_user_role(m.from_user.id)
    await m.answer("🤔 Введите /start для меню", reply_markup=main_kb(role))

# ═══════════════════════════════════════════
# FastAPI — Webhook
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

@app.get("/bot/users")
async def bot_users():
    """Эндпоинт для просмотра всех пользователей бота"""
    return {"users": load_users()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
