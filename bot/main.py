"""
Interio Telegram Bot — Webhook на том же Render сервисе
"""
import os
import asyncio
import logging
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from aiogram import Bot, Dispatcher, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage

# Настройки
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ADMIN_CHAT = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
GIGACHAT_KEY = os.getenv("GIGACHAT_AUTH_KEY", "")
# URL этого же Render сервиса (заполни после деплоя)
APP_URL = os.getenv("FRONTEND_URL", "https://interio.onrender.com")

logging.basicConfig(level=logging.INFO)

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())
app = FastAPI()

# ═══ FSM States ═══
class QuizState(StatesGroup):
    name = State(); phone = State(); room = State()
    zones = State(); area = State(); style = State()
    budget = State(); comment = State(); consent = State()

class SupportState(StatesGroup):
    waiting = State()

# ═══ Клавиатуры ═══
def main_kb():
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏠 Пройти квиз", callback_data="quiz_start")],
        [InlineKeyboardButton(text="🌐 Квиз в браузере", web_app=WebAppInfo(url=f"{APP_URL}/quiz"))],
        [InlineKeyboardButton(text="🤖 ИИ-советник", callback_data="support")],
        [InlineKeyboardButton(text="📋 Мои заявки", callback_data="requests")],
        [InlineKeyboardButton(text="ℹ️ О сервисе", callback_data="about")],
    ])
    return kb

def back_kb():
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Меню", callback_data="back")]])

# ═══ GigaChat ═══
_gc_tok, _gc_exp = None, 0
DESIGN_WORDS = ["дизайн","интерьер","ремонт","стиль","квартир","комнат","мебел","отделк","планировк","освещен","цвет","бюджет","кухн","спальн","гостин","лофт","минимализм","скандинав","классик","диван","стол","шкаф","декор","interior","design"]

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
            d = r.json(); _gc_tok = d.get("access_token")
            exp = d.get("expires_at", 0)
            _gc_exp = (exp-60) if exp > 1e9 else (time.time()+1740)
            return _gc_tok
    except: return None

def is_design(t): return any(w in t.lower() for w in DESIGN_WORDS)

async def ask_gc(q):
    if not is_design(q): return "🏠 Я помогаю только с дизайном интерьера!"
    tok = await gc_token()
    if not tok: return "🤖 ИИ временно недоступен"
    try:
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            r = await c.post("https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
                headers={"Authorization":f"Bearer {tok}"},
                json={"model":"GigaChat","messages":[{"role":"user","content":f"Ты — дизайнер интерьера. Кратко (2-3 предложения): {q}"}],"max_tokens":300})
            return r.json()["choices"][0]["message"]["content"].strip()
    except: return "⚠️ Ошибка ИИ"

# ═══ Уведомление менеджеру ═══
async def notify_manager(text):
    if not bot or not ADMIN_CHAT: return
    try: await bot.send_message(ADMIN_CHAT, text, parse_mode="HTML")
    except: pass

# ═══ Handlers ═══
@dp.message(CommandStart())
async def cmd_start(m: Message, s: FSMContext):
    await s.clear()
    await m.answer(f"👋 Добро пожаловать в <b>Interio</b>!\n\nСоздай дизайн-проект за 6 шагов!", reply_markup=main_kb(), parse_mode="HTML")

@dp.callback_query(F.data == "back")
async def go_back(cb: CallbackQuery, s: FSMContext):
    await s.clear()
    await cb.message.edit_text("🏠 Главное меню", reply_markup=main_kb(), parse_mode="HTML")

@dp.callback_query(F.data == "about")
async def go_about(cb: CallbackQuery):
    await cb.message.edit_text(
        f"ℹ️ <b>Interio</b> — платформа для создания дизайн-проектов.\n\n"
        f"🏠 Квиз из 6 шагов\n🤖 ИИ-советник\n📄 PDF-бриф\n🖼 Портфолио\n\n"
        f"🌐 {APP_URL}", reply_markup=back_kb(), parse_mode="HTML")

@dp.callback_query(F.data == "requests")
async def go_requests(cb: CallbackQuery):
    await cb.message.edit_text(f"📋 Заявки доступны на сайте:\n{APP_URL}/admin\n\nИли в Telegram-квизе после прохождения.", reply_markup=back_kb())

# ─── Квиз в Telegram ───
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
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Квартира", callback_data="qr:Квартира")],
        [InlineKeyboardButton(text="Частный дом", callback_data="qr:Частный дом")],
        [InlineKeyboardButton(text="Офис", callback_data="qr:Офис")],
        [InlineKeyboardButton(text="Коммерческое", callback_data="qr:Коммерческое")],
    ])
    await m.answer("🏠 <b>Шаг 3/7</b>\n\nТип помещения:", reply_markup=kb, parse_mode="HTML")

@dp.callback_query(F.data.startswith("qr:"))
async def quiz_room(cb: CallbackQuery, s: FSMContext):
    room = cb.data.split(":",1)[1]
    await s.update_data(room_type=room)
    await s.set_state(QuizState.style)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Современный", callback_data="qs:Современный")],
        [InlineKeyboardButton(text="Минимализм", callback_data="qs:Минимализм")],
        [InlineKeyboardButton(text="Скандинавский", callback_data="qs:Скандинавский")],
        [InlineKeyboardButton(text="Лофт", callback_data="qs:Лофт")],
        [InlineKeyboardButton(text="Классика", callback_data="qs:Классика")],
    ])
    await cb.message.edit_text("🎨 <b>Шаг 4/7</b>\n\nСтиль:", reply_markup=kb, parse_mode="HTML")

@dp.callback_query(F.data.startswith("qs:"))
async def quiz_style(cb: CallbackQuery, s: FSMContext):
    style = cb.data.split(":",1)[1]
    await s.update_data(style=style)
    await s.set_state(QuizState.budget)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="До 500k", callback_data="qb:До 500 000 ₽")],
        [InlineKeyboardButton(text="500k – 1M", callback_data="qb:500 000 – 1 000 000 ₽")],
        [InlineKeyboardButton(text="1M – 2M", callback_data="qb:1 000 000 – 2 000 000 ₽")],
        [InlineKeyboardButton(text="От 2M", callback_data="qb:От 2 000 000 ₽")],
    ])
    await cb.message.edit_text("💰 <b>Шаг 5/7</b>\n\nБюджет:", reply_markup=kb, parse_mode="HTML")

@dp.callback_query(F.data.startswith("qb:"))
async def quiz_budget(cb: CallbackQuery, s: FSMContext):
    budget = cb.data.split(":",1)[1]
    await s.update_data(budget=budget)
    await s.set_state(QuizState.area)
    await cb.message.edit_text("📐 <b>Шаг 6/7</b>\n\nПлощадь в м² (число):", parse_mode="HTML")

@dp.message(QuizState.area)
async def quiz_area(m: Message, s: FSMContext):
    try:
        area = int(m.text)
    except: area = 60
    await s.update_data(area=area)
    await s.set_state(QuizState.comment)
    await m.answer("💬 <b>Шаг 7/7</b>\n\nКомментарий (или «нет»):")

@dp.message(QuizState.comment)
async def quiz_comment(m: Message, s: FSMContext):
    d = await s.get_data()
    comment = m.text if m.text.lower() != "нет" else ""
    await m.answer("⏳ Создаём проект...")

    # Сохраняем через API
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{APP_URL}/api/quiz/submit", json={
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
                f"🔗 Результат: {APP_URL}/result/{sl}",
                reply_markup=main_kb(), parse_mode="HTML"
            )
    except Exception as e:
        await m.answer(f"❌ Ошибка: {e}", reply_markup=main_kb())
    await s.clear()

# ─── ИИ-советник ───
@dp.message(Command("support"))
@dp.callback_query(F.data == "support")
async def cmd_support(ev, s: FSMContext):
    msg = ev.message if hasattr(ev, 'message') else ev
    if hasattr(ev, 'answer'): await ev.answer()
    await s.set_state(SupportState.waiting)
    await msg.answer("🤖 <b>ИИ-советник</b>\n\nЗадайте вопрос о дизайне!", reply_markup=back_kb(), parse_mode="HTML")

@dp.message(SupportState.waiting)
async def support_msg(m: Message, s: FSMContext):
    thinking = await m.answer("🤔 Думаю...")
    answer = await ask_gc(m.text)
    await thinking.delete()
    await m.answer(answer, reply_markup=back_kb())

# ─── Неизвестные команды ───
@dp.message()
async def unknown(m: Message):
    await m.answer("🤔 Введите /start для меню", reply_markup=main_kb())

# ═══ FastAPI Webhook ═══
@app.on_event("startup")
async def startup():
    if BOT_TOKEN:
        url = os.getenv("WEBHOOK_URL", "")
        if url:
            await bot.set_webhook(f"{url}/tg-webhook")
            logging.info(f"Webhook set to {url}/tg-webhook")
        else:
            asyncio.create_task(dp.start_polling(bot, skip_updates=True))
            logging.info("Polling started")

@app.post("/tg-webhook")
async def webhook(req: Request):
    data = await req.json()
    await dp.feed_webhook_update(bot, data)
    return JSONResponse({"ok": True})

@app.get("/health")
async def health():
    return {"status": "ok", "bot": "Interio"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
