"""
Interio Telegram Bot — Webhook на Render
Интеграция с GigaChat AI, квиз в Telegram, уведомления менеджеру
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
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
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
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "https://interio-bsw3.onrender.com")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())
app = FastAPI()

# ═══════════════════════════════════════════
# FSM States
# ═══════════════════════════════════════════
class QuizState(StatesGroup):
    name = State(); phone = State(); room = State()
    zones = State(); area = State(); style = State()
    budget = State(); comment = State()

class SupportState(StatesGroup):
    waiting = State()

# ═══════════════════════════════════════════
# Клавиатуры
# ═══════════════════════════════════════════
def main_kb():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏠 Пройти квиз", callback_data="quiz_start")],
        [InlineKeyboardButton(text="🌐 Квиз на сайте", web_app=WebAppInfo(url=f"{FRONTEND_URL}/quiz"))],
        [InlineKeyboardButton(text="🤖 ИИ-советник (GigaChat)", callback_data="support")],
        [InlineKeyboardButton(text="📋 Мои заявки", callback_data="requests")],
        [InlineKeyboardButton(text="🖼 Портфолио", web_app=WebAppInfo(url=f"{FRONTEND_URL}/portfolio"))],
        [InlineKeyboardButton(text="ℹ️ О сервисе", callback_data="about")],
    ])

def back_kb():
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Главное меню", callback_data="back")]])

def rooms_kb():
    rooms = ["Квартира","Частный дом","Офис","Коммерческое","Студия","Другое"]
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=r,callback_data=f"qr:{r}")] for r in rooms])

def styles_kb():
    s = ["Современный","Минимализм","Скандинавский","Классика","Лофт","Неоклассика"]
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=x,callback_data=f"qs:{x}")] for x in s])

def budgets_kb():
    b = ["До 500k","500k–1M","1M–2M","От 2M","Не знаю"]
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=x,callback_data=f"qb:{x}")] for x in b])

# ═══════════════════════════════════════════
# GigaChat AI
# ═══════════════════════════════════════════
_gc_tok, _gc_exp = None, 0
DESIGN_WORDS = [
    "дизайн","интерьер","ремонт","стиль","квартир","комнат","мебел","отделк",
    "планировк","освещен","цвет","бюджет","кухн","спальн","гостин","лофт",
    "минимализм","скандинав","классик","диван","стол","шкаф","декор",
    "interior","design","renovation","furniture","budget","room"
]

async def gc_token():
    global _gc_tok, _gc_exp
    import time, base64, uuid
    if _gc_tok and time.time() < _gc_exp: return _gc_tok
    if not GIGACHAT_KEY: return None
    try:
        async with httpx.AsyncClient(verify=False) as c:
            r = await c.post("https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
                headers={"Authorization":f"Basic {GIGACHAT_KEY}","RqUID":str(uuid.uuid4())},
                data={"scope":"GIGACHAT_API_PERS"}, timeout=10)
            d = r.json()
            _gc_tok = d.get("access_token")
            exp = d.get("expires_at", 0)
            _gc_exp = (exp-60) if exp > 1e9 else (time.time()+1740)
            return _gc_tok
    except: return None

def is_design(t): return any(w in t.lower() for w in DESIGN_WORDS)

async def ask_gc(q):
    if not is_design(q):
        return "🏠 Я помогаю только с вопросами по дизайну интерьера, бюджету, планировке и стилям!"
    tok = await gc_token()
    if not tok: return "🤖 ИИ временно недоступен"
    try:
        async with httpx.AsyncClient(verify=False, timeout=20) as c:
            r = await c.post("https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
                headers={"Authorization":f"Bearer {tok}"},
                json={"model":"GigaChat","messages":[{"role":"user","content":f"Ты — дизайнер интерьера. Кратко (2-3 предложения): {q}"}],
                      "max_tokens":300,"temperature":0.7})
            return r.json()["choices"][0]["message"]["content"].strip()
    except: return "⚠️ Ошибка ИИ"

# ═══════════════════════════════════════════
# Уведомление менеджеру
# ═══════════════════════════════════════════
async def notify_mgr(text):
    if not ADMIN_CHAT or not bot: return
    try: await bot.send_message(ADMIN_CHAT, text, parse_mode="HTML")
    except: pass

# ═══════════════════════════════════════════
# Handlers — Главное меню
# ═══════════════════════════════════════════
@dp.message(CommandStart())
async def cmd_start(m: Message, s: FSMContext):
    await s.clear()
    await m.answer(
        f"👋 Добро пожаловать в <b>Interio</b>!\n\n"
        f"🏠 Квиз из 6 шагов — создайте дизайн-проект\n"
        f"🤖 ИИ-советник на базе GigaChat\n"
        f"🖼 Портфолио работ\n\n"
        f"🌐 {FRONTEND_URL}",
        reply_markup=main_kb(), parse_mode="HTML")

@dp.callback_query(F.data == "back")
async def go_back(cb: CallbackQuery, s: FSMContext):
    await s.clear()
    await cb.message.edit_text("🏠 Главное меню", reply_markup=main_kb(), parse_mode="HTML")

@dp.callback_query(F.data == "about")
async def go_about(cb: CallbackQuery):
    await cb.message.edit_text(
        f"ℹ️ <b>Interio</b> — платформа для создания дизайн-проектов.\n\n"
        f"• Квиз из 6 шагов\n"
        f"• ИИ-советник (GigaChat)\n"
        f"• PDF-бриф\n"
        f"• Портфолио работ\n\n"
        f"🌐 {FRONTEND_URL}",
        reply_markup=back_kb(), parse_mode="HTML")

@dp.callback_query(F.data == "requests")
async def go_requests(cb: CallbackQuery):
    await cb.message.edit_text(
        f"📋 Заявки доступны на сайте:\n{FRONTEND_URL}/admin\n\n"
        f"Или пройдите квиз в Telegram — заявка сохранится.",
        reply_markup=back_kb())

# ═══════════════════════════════════════════
# Handlers — Квиз в Telegram
# ═══════════════════════════════════════════
@dp.callback_query(F.data == "quiz_start")
@dp.message(Command("quiz"))
async def quiz_start(ev, s: FSMContext):
    msg = ev.message if hasattr(ev, 'message') else ev
    if hasattr(ev, 'answer'): await ev.answer()
    await s.set_state(QuizState.name)
    await msg.answer("👤 <b>Шаг 1/7</b>\n\nВаше имя:", parse_mode="HTML")

@dp.message(QuizState.name)
async def quiz_name(m: Message, s: FSMContext):
    await s.update_data(name=m.text)
    await s.set_state(QuizState.phone)
    await m.answer("📱 <b>Шаг 2/7</b>\n\nТелефон (например +79991234567):")

@dp.message(QuizState.phone)
async def quiz_phone(m: Message, s: FSMContext):
    await s.update_data(phone=m.text)
    await s.set_state(QuizState.room)
    await m.answer("🏠 <b>Шаг 3/7</b>\n\nТип помещения:", reply_markup=rooms_kb(), parse_mode="HTML")

@dp.callback_query(F.data.startswith("qr:"))
async def quiz_room(cb: CallbackQuery, s: FSMContext):
    room = cb.data.split(":",1)[1]
    await s.update_data(room_type=room)
    await s.set_state(QuizState.style)
    await cb.message.edit_text("🎨 <b>Шаг 4/7</b>\n\nСтиль интерьера:", reply_markup=styles_kb(), parse_mode="HTML")

@dp.callback_query(F.data.startswith("qs:"))
async def quiz_style(cb: CallbackQuery, s: FSMContext):
    style = cb.data.split(":",1)[1]
    await s.update_data(style=style)
    await s.set_state(QuizState.budget)
    await cb.message.edit_text("💰 <b>Шаг 5/7</b>\n\nБюджет:", reply_markup=budgets_kb(), parse_mode="HTML")

@dp.callback_query(F.data.startswith("qb:"))
async def quiz_budget(cb: CallbackQuery, s: FSMContext):
    budget = cb.data.split(":",1)[1]
    await s.update_data(budget=budget)
    await s.set_state(QuizState.area)
    await cb.message.edit_text("📐 <b>Шаг 6/7</b>\n\nПлощадь в м² (число):", parse_mode="HTML")

@dp.message(QuizState.area)
async def quiz_area(m: Message, s: FSMContext):
    try: area = int(m.text)
    except: area = 60
    await s.update_data(area=area)
    await s.set_state(QuizState.comment)
    await m.answer("💬 <b>Шаг 7/7</b>\n\nКомментарий (или «нет»):")

@dp.message(QuizState.comment)
async def quiz_comment(m: Message, s: FSMContext):
    d = await s.get_data()
    comment = m.text if m.text.lower() != "нет" else ""
    await m.answer("⏳ Создаём проект...")

    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{FRONTEND_URL}/api/quiz/submit", json={
                "name": d.get("name",""),
                "phone": d.get("phone",""),
                "room_type": d.get("room_type",""),
                "style": d.get("style",""),
                "budget": d.get("budget",""),
                "area": d.get("area", 60),
                "zones": ["Гостиная"],
                "comment": comment,
                "consent": True,
                "photo_urls": []
            })
            res = r.json()
            sl = res.get("share_link", "")
            await m.answer(
                f"🎉 <b>Проект готов!</b>\n\n"
                f"🏠 {d.get('room_type')} | {d.get('style')}\n"
                f"💰 {d.get('budget')}\n\n"
                f"🔗 Результат: {FRONTEND_URL}/result/{sl}\n\n"
                f"📄 PDF и QR-код доступны на странице результата.",
                reply_markup=main_kb(), parse_mode="HTML"
            )
            # Уведомление менеджеру
            txt = f"🏠 <b>Новая заявка из Telegram</b>\n👤 {d.get('name','')}\n📱 {d.get('phone','')}\n🏢 {d.get('room_type','')}\n🎨 {d.get('style','')}\n💰 {d.get('budget','')}"
            await notify_mgr(txt)
    except Exception as e:
        await m.answer(f"❌ Ошибка: {e}", reply_markup=main_kb())
    await s.clear()

# ═══════════════════════════════════════════
# Handlers — GigaChat ИИ-советник
# ═══════════════════════════════════════════
@dp.message(Command("support"))
@dp.callback_query(F.data == "support")
async def cmd_support(ev, s: FSMContext):
    msg = ev.message if hasattr(ev, 'message') else ev
    if hasattr(ev, 'answer'): await ev.answer()
    await s.set_state(SupportState.waiting)
    await msg.answer(
        "🤖 <b>ИИ-советник GigaChat</b>\n\n"
        "Задайте вопрос о дизайне интерьера!\n\n"
        "Примеры:\n"
        "• Какой стиль для маленькой кухни?\n"
        "• Как выбрать цветовую гамму?\n"
        "• Какой бюджет на ремонт 60м²?",
        reply_markup=back_kb(), parse_mode="HTML")

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
