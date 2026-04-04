"""
Interio Bot — Telegram Bot Entry Point
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

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8781630278:AAH4LqIzaQBRY7tOsOZkwbujwMF8r9ySuuQ")
ADMIN_CHAT = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
GIGACHAT_KEY = os.getenv("GIGACHAT_AUTH_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://interio-y5lf.onrender.com")
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "https://interio-bsw3.onrender.com")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())
app = FastAPI()

class SupportState(StatesGroup):
    waiting = State()

DESIGN_WORDS = ["дизайн","интерьер","ремонт","стиль","квартир","комнат","мебел","отделк",
    "планировк","освещен","цвет","бюджет","кухн","спальн","гостин","лофт",
    "минимализм","скандинав","классик","диван","стол","шкаф","декор",
    "interior","design","renovation","furniture","budget","room"]

_gc_tok, _gc_exp = None, 0

async def gc_token():
    global _gc_tok, _gc_exp
    import time, uuid
    if _gc_tok and time.time() < _gc_exp: return _gc_tok
    if not GIGACHAT_KEY: return None
    try:
        async with httpx.AsyncClient(verify=False) as c:
            r = await c.post("https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
                headers={"Authorization":f"Basic {GIGACHAT_KEY}","RqUID":str(uuid.uuid4())},
                data={"scope":"GIGACHAT_API_PERS"}, timeout=10)
            d = r.json(); _gc_tok = d.get("access_token")
            exp = d.get("expires_at", 0); _gc_exp = (exp-60) if exp > 1e9 else (time.time()+1740)
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

def main_kb():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏠 Пройти квиз", web_app=WebAppInfo(url=f"{FRONTEND_URL}/quiz"))],
        [InlineKeyboardButton(text="🤖 ИИ-советник (GigaChat)", callback_data="support")],
        [InlineKeyboardButton(text="📋 Мои заявки", web_app=WebAppInfo(url=f"{FRONTEND_URL}/admin"))],
        [InlineKeyboardButton(text="🖼 Портфолио", web_app=WebAppInfo(url=f"{FRONTEND_URL}/portfolio"))],
        [InlineKeyboardButton(text="ℹ️ О сервисе", callback_data="about")],
    ])

def back_kb():
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Главное меню", callback_data="back")]])

@dp.message(CommandStart())
async def cmd_start(m: Message):
    await m.answer(
        f"👋 Добро пожаловать в <b>Interio</b>!\n\n"
        f"🏠 Создайте дизайн-проект\n"
        f"🤖 ИИ-советник на базе GigaChat\n"
        f"📄 Получите PDF-бриф\n"
        f"🖼 Публикуйте в портфолио\n\n"
        f"🌐 {FRONTEND_URL}",
        reply_markup=main_kb(), parse_mode="HTML")

@dp.callback_query(F.data == "back")
async def go_back(cb: CallbackQuery, s: FSMContext):
    await s.clear()
    await cb.message.edit_text("🏠 Главное меню", reply_markup=main_kb(), parse_mode="HTML")

@dp.callback_query(F.data == "about")
async def go_about(cb: CallbackQuery):
    await cb.message.edit_text(
        "ℹ️ <b>Interio</b> — платформа для создания дизайн-проектов.\n\n"
        "• Квиз из 6 шагов\n• Голосовой ввод\n• Загрузка фото\n"
        "• ИИ-советник (GigaChat)\n• PDF-бриф\n• QR-код\n• Портфолио работ\n\n"
        f"🌐 {FRONTEND_URL}",
        reply_markup=back_kb(), parse_mode="HTML")

@dp.callback_query(F.data == "support")
@dp.message(Command("support"))
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

@dp.message()
async def unknown(m: Message):
    await m.answer("🤔 Введите /start для меню", reply_markup=main_kb())

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
