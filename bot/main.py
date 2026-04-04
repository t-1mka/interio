"""
Telegram-бот «Интерио» — FastAPI Web Service для Render.
Расширенные команды + квиз внутри Telegram + GigaChat-поддержка.
"""
import asyncio
import logging
import os
from fastapi import FastAPI
from fastapi.responses import JSONResponse
import uvicorn
import httpx
from aiogram import Bot, Dispatcher, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://interio.vercel.app")
GIGACHAT_AUTH_KEY = os.getenv("GIGACHAT_AUTH_KEY", "")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())
app = FastAPI(title="Interio Bot")

# ═══ FSM States ═══
class QuizState(StatesGroup):
    room = State(); style = State(); budget = State(); deadline = State()
    colors = State(); wishes = State(); contact_name = State(); contact_phone = State()

class SupportState(StatesGroup):
    waiting_message = State()

# ═══ Keyboards ═══
def main_kb(url=FRONTEND_URL):
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏠 Пройти квиз", callback_data="quiz_start")],
        [InlineKeyboardButton(text="🌐 Квиз в браузере", web_app=WebAppInfo(url=f"{url}/quiz"))],
        [InlineKeyboardButton(text="🤖 ИИ-советник", callback_data="support")],
        [InlineKeyboardButton(text="📋 Мои заявки", callback_data="my_requests")],
        [InlineKeyboardButton(text="🖼 Портфолио", web_app=WebAppInfo(url=f"{url}/portfolio"))],
        [InlineKeyboardButton(text="ℹ️ О сервисе", callback_data="about")],
    ])

def back_kb():
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Главное меню", callback_data="back_to_start")]])

def rooms_kb():
    rooms = ["Квартира","Частный дом","Офис","Коммерческое","Студия","Другое"]
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=r,callback_data=f"qr:{r}")] for r in rooms])

def styles_kb():
    s = ["Современный","Минимализм","Скандинавский","Классический","Лофт","Японский","Арт-деко"]
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=x,callback_data=f"qs:{x}")] for x in s])

def deadlines_kb():
    d = ["1 месяц","3 месяца","6 месяцев","Без срока"]
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=x,callback_data=f"qd:{x}")] for x in d])

def colors_kb():
    c = [("⬜ Белый","Белый"),("⬛ Тёмный","Тёмный"),("🟤 Дерево","Деревянный"),("🔵 Синий","Синий"),("🟢 Зелёный","Зелёный"),("🟡 Жёлтый","Жёлтый"),("🩷 Розовый","Розовый"),("🎨 Разноцветный","Разноцветный")]
    kb = [[InlineKeyboardButton(text=l,callback_data=f"qc:{v}")] for l,v in c]
    kb.append([InlineKeyboardButton(text="✅ Готово",callback_data="qc_done")])
    return InlineKeyboardMarkup(inline_keyboard=kb)

def support_kb_():
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 В меню", callback_data="back_to_start")]])

# ═══ GigaChat ═══
_gc_tok, _gc_exp = None, 0
TOPICS = ["дизайн","интерьер","ремонт","стиль","квартир","комнат","мебел","отделк","планировк","освещен","цвет","бюджет","кухн","спальн","гостин","лофт","минимализм","скандинав","классик","диван","стол","шкаф","декор","interior","design"]

async def gc_token():
    global _gc_tok, _gc_exp
    import time, base64, uuid
    if _gc_tok and time.time() < _gc_exp: return _gc_tok
    if not GIGACHAT_AUTH_KEY: return None
    cr = base64.b64encode(GIGACHAT_AUTH_KEY.encode()).decode()
    try:
        async with httpx.AsyncClient(verify=False) as c:
            r = await c.post("https://ngw.devices.sberbank.ru:9443/api/v2/oauth", headers={"Authorization":f"Basic {cr}","RqUID":str(uuid.uuid4())}, data={"scope":"GIGACHAT_API_PERS"}, timeout=10)
            r.raise_for_status(); d=r.json(); _gc_tok=d.get("access_token"); _gc_exp=time.time()+d.get("expires_at",1800)-60; return _gc_tok
    except: return None

def is_topic(t): return any(w in t.lower() for w in TOPICS)

async def ask_gc(q):
    if not is_topic(q): return "🏠 Я помогаю только с дизайном интерьера! Спросите о стилях, материалах, планировке или бюджете."
    tok = await gc_token()
    if not tok: return "🤖 ИИ временно недоступен. Опишите пожелания — дизайнер поможет!"
    try:
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            r = await c.post("https://gigachat.devices.sberbank.ru/api/v1/chat/completions", headers={"Authorization":f"Bearer {tok}"}, json={"model":"GigaChat","messages":[{"role":"user","content":f"Ты — дизайнер интерьера. Кратко (2-4 предложения): {q}"}], "max_tokens":300, "temperature":0.7})
            return r.json()["choices"][0]["message"]["content"].strip()
    except: return "⚠️ Ошибка ИИ."

# ═══ Handlers ═══
@dp.message(CommandStart())
async def cmd_start(m: Message, s: FSMContext):
    await s.clear()
    await m.answer(
        "👋 Добро пожаловать в <b>Интерио</b>!\n\n"
        "🏠 Создайте дизайн-проект за 6 шагов\n"
        "🤖 ИИ-советник ответит на вопросы\n"
        "📄 Получите PDF-бриф\n"
        "🖼 Опубликуйте в портфолио",
        reply_markup=main_kb(), parse_mode="HTML")

@dp.callback_query(F.data=="back_to_start")
async def back(cb: CallbackQuery, s: FSMContext):
    await s.clear()
    await cb.message.edit_text("🏠 Главное меню <b>Интерио</b>", reply_markup=main_kb(), parse_mode="HTML")

@dp.callback_query(F.data=="about")
async def about(cb: CallbackQuery):
    await cb.message.edit_text(
        "ℹ️ <b>О Интерио</b>\n\n"
        "Сервис для создания персонального дизайн-проекта.\n\n"
        "✅ Квиз из 6 шагов\n🤖 ИИ-поддержка\n🎨 Генерация дизайна\n📄 PDF-бриф\n🖼 Портфолио\n\n"
        f"🌐 {FRONTEND_URL}", reply_markup=back_kb(), parse_mode="HTML")

@dp.callback_query(F.data=="help")
async def help_cmd(cb: CallbackQuery):
    await cb.message.edit_text(
        "📋 <b>Доступные команды:</b>\n\n"
        "/start — Главное меню\n"
        "/quiz — Начать квиз\n"
        "/support — ИИ-советник\n"
        "/requests — Мои заявки\n"
        "/about — О сервисе\n"
        "/help — Эта справка\n\n"
        "Или используйте кнопки ниже 👇",
        reply_markup=main_kb(), parse_mode="HTML")

# ─── Quiz ───
@dp.callback_query(F.data=="quiz_start")
@dp.message(Command("quiz"))
async def quiz_start(m_or_cb, s: FSMContext):
    is_cb = isinstance(m_or_cb, CallbackQuery)
    msg = m_or_cb.message if is_cb else m_or_cb
    if is_cb: await m_or_cb.answer()
    await s.set_state(QuizState.room); await s.update_data(colors=[])
    await msg.answer("📍 <b>Шаг 1/6 — Помещение</b>\n\nКакую комнату оформить?", reply_markup=rooms_kb(), parse_mode="HTML")

@dp.callback_query(F.data.startswith("qr:"))
async def quiz_room(cb: CallbackQuery, s: FSMContext):
    room = cb.data.split(":",1)[1]; await s.update_data(room=room); await s.set_state(QuizState.style)
    await cb.message.edit_text(f"✅ {room}\n\n🎨 <b>Шаг 2/6 — Стиль</b>\n\nКакой стиль нравится?", reply_markup=styles_kb(), parse_mode="HTML")

@dp.callback_query(F.data.startswith("qs:"))
async def quiz_style(cb: CallbackQuery, s: FSMContext):
    style = cb.data.split(":",1)[1]; await s.update_data(style=style); await s.set_state(QuizState.budget)
    await cb.message.edit_text(f"✅ {style}\n\n💰 <b>Шаг 3/6 — Бюджет</b>\n\nНапишите: <code>мин макс</code> (тыс. руб.), например <code>200 500</code>", parse_mode="HTML")

@dp.message(QuizState.budget)
async def quiz_budget(m: Message, s: FSMContext):
    try:
        p = m.text.strip().split(); mn,mx = int(p[0]),int(p[1])
        await s.update_data(budget_min=mn,budget_max=mx); await s.set_state(QuizState.deadline)
        await m.answer(f"✅ {mn}–{mx} тыс. руб.\n\n⏱ <b>Шаг 4/6 — Сроки</b>", reply_markup=deadlines_kb(), parse_mode="HTML")
    except: await m.answer("❌ Введите два числа: <code>200 500</code>", parse_mode="HTML")

@dp.callback_query(F.data.startswith("qd:"))
async def quiz_deadline(cb: CallbackQuery, s: FSMContext):
    dl = cb.data.split(":",1)[1]; await s.update_data(deadline=dl); await s.set_state(QuizState.colors)
    await cb.message.edit_text(f"✅ {dl}\n\n🎨 <b>Шаг 5/6 — Цвета</b>\n\nВыберите (можно несколько):", reply_markup=colors_kb(), parse_mode="HTML")

@dp.callback_query(F.data.startswith("qc:"))
async def quiz_color(cb: CallbackQuery, s: FSMContext):
    c = cb.data.split(":",1)[1]; d=await s.get_data(); cl=d.get("colors",[])
    if c not in cl: cl.append(c); await s.update_data(colors=cl)
    await cb.answer(f"✅ {c}")

@dp.callback_query(F.data=="qc_done")
async def quiz_colors_done(cb: CallbackQuery, s: FSMContext):
    d=await s.get_data(); cl=d.get("colors",[])
    if not cl: await cb.answer("Выберите хотя бы один цвет!",show_alert=True); return
    await s.set_state(QuizState.wishes)
    await cb.message.edit_text(f"✅ Цвета: {', '.join(cl)}\n\n💭 <b>Шаг 6/6 — Пожелания</b>\n\nНапишите пожелания (или «нет»):", parse_mode="HTML")

@dp.message(QuizState.wishes)
async def quiz_wishes(m: Message, s: FSMContext):
    w = m.text if m.text.lower()!="нет" else ""
    await s.update_data(wishes=w); await s.set_state(QuizState.contact_name)
    await m.answer("👤 <b>Контакты</b>\n\nВаше имя:", parse_mode="HTML")

@dp.message(QuizState.contact_name)
async def quiz_name(m: Message, s: FSMContext):
    await s.update_data(contact_name=m.text); await s.set_state(QuizState.contact_phone)
    await m.answer("📱 Номер телефона:")

@dp.message(QuizState.contact_phone)
async def quiz_phone(m: Message, s: FSMContext):
    await s.update_data(contact_phone=m.text); d=await s.get_data()
    await m.answer("⏳ Создаём проект...")
    payload = {"room":d.get("room",""),"style":d.get("style",""),"budget_min":d.get("budget_min",100),"budget_max":d.get("budget_max",300),"deadline":d.get("deadline","3 месяца"),"colors":d.get("colors",[]),"wishes":d.get("wishes",""),"contact_name":d.get("contact_name",""),"contact_phone":d.get("contact_phone",""),"contact_email":""}
    try:
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(f"{FRONTEND_URL}/api/quiz/submit", json=payload); r.raise_for_status(); res=r.json()
        sl=res.get("share_link",""); pr=res.get("promo_code",""); cost=res.get("estimated_cost",0)
        await m.answer(f"🎉 <b>Проект готов!</b>\n\n🏠 {payload['room']} | {payload['style']}\n💰 ~{cost:,.0f} руб.\n🎁 {pr}\n\n🔗 {FRONTEND_URL}/result/{sl}", reply_markup=back_kb(), parse_mode="HTML")
    except Exception as e:
        logger.error("Quiz error: %s", e)
        await m.answer(f"❌ Ошибка. Пройдите на сайте: {FRONTEND_URL}/quiz", reply_markup=back_kb())
    await s.clear()

# ─── Support ───
@dp.message(Command("support"))
@dp.callback_query(F.data=="support")
async def cmd_support(ev, s: FSMContext):
    msg = ev.message if isinstance(ev, CallbackQuery) else ev
    if isinstance(ev, CallbackQuery): await ev.answer()
    await s.set_state(SupportState.waiting_message)
    await msg.answer("🤖 <b>ИИ-советник</b>\n\nЗадайте вопрос о дизайне!\n\nПримеры:\n• Какой стиль для маленькой кухни?\n• Как выбрать цветовую гамму?", reply_markup=support_kb_(), parse_mode="HTML")

@dp.message(SupportState.waiting_message)
async def support_msg(m: Message, s: FSMContext):
    thinking = await m.answer("🤔 Думаю...")
    answer = await ask_gc(m.text)
    await thinking.delete()
    await m.answer(answer, reply_markup=support_kb_(), parse_mode="HTML" if "<" in answer else None)

# ─── Requests ───
@dp.callback_query(F.data=="my_requests")
@dp.message(Command("requests"))
async def my_req(ev, s: FSMContext):
    msg = ev.message if isinstance(ev, CallbackQuery) else ev
    if isinstance(ev, CallbackQuery): await ev.answer()
    await msg.answer(f"📋 Ваши заявки:\n{FRONTEND_URL}/api/quiz/submissions", reply_markup=back_kb())

# ─── Unknown ───
@dp.message()
async def unknown(m: Message):
    await m.answer("🤔 Неизвестная команда. Введите /help для списка.", reply_markup=main_kb())

# ═══ FastAPI ═══
@app.on_event("startup")
async def startup():
    logger.info("🤖 Interio Bot starting...")
    asyncio.create_task(dp.start_polling(bot, skip_updates=True))

@app.get("/health", response_class=JSONResponse)
async def health(): return {"status":"ok","bot":"Interio"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
