"""
Interio Telegram Bot — polling mode
"""
import os, asyncio, logging, json, httpx
from dotenv import load_dotenv
load_dotenv()

from aiogram import Bot, Dispatcher, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
GIGACHAT_KEY = os.getenv("GIGACHAT_AUTH_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://interio-y5lf.onrender.com")
USERS_FILE = os.path.join(os.path.dirname(__file__), "data", "bot_users.json")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())

def _load():
    try:
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, "r", encoding="utf-8") as f: return json.load(f)
    except: pass
    return {}

def _save(u):
    os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
    with open(USERS_FILE, "w", encoding="utf-8") as f: json.dump(u, f, ensure_ascii=False, indent=2)

def _role(tid): return _load().get(str(tid), {}).get("role")
def _set(tid, name, phone, role):
    u = _load(); u[str(tid)] = {"name": name, "phone": phone, "role": role}; _save(u)
def _mgrs(): return [int(i) for i, u in _load().items() if u.get("role") == "manager"]

async def _notify(text):
    for m in _mgrs():
        try: await bot.send_message(m, text, parse_mode="HTML")
        except Exception as e: logging.error(f"Notify err: {e}")

_gc_tok, _gc_exp = None, 0
DW = ["дизайн","интерьер","ремонт","стиль","квартир","комнат","мебел","отделк","планировк","освещен","цвет","бюджет","кухн","спальн","гостин","лофт","минимализм","скандинав","классик","диван","стол","шкаф","декор","interior","design","renovation","furniture","budget","room"]

async def _gctok():
    global _gc_tok, _gc_exp
    import time, uuid
    if _gc_tok and time.time() < _gc_exp: return _gc_tok
    if not GIGACHAT_KEY: return None
    try:
        async with httpx.AsyncClient(verify=False) as c:
            r = await c.post("https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
                headers={"Authorization": f"Basic {GIGACHAT_KEY}", "RqUID": str(uuid.uuid4())},
                data={"scope": "GIGACHAT_API_PERS"}, timeout=10)
            d = r.json(); _gc_tok = d.get("access_token"); exp = d.get("expires_at", 0)
            _gc_exp = (exp-60) if exp>1e9 else (time.time()+1740); return _gc_tok
    except: return None

def _is_d(t): return any(w in t.lower() for w in DW)

async def _gcask(q):
    if not _is_d(q): return "💡 Я помогаю только с вопросами по дизайну интерьера!"
    t = await _gctok()
    if not t: return "🤖 ИИ недоступен"
    try:
        async with httpx.AsyncClient(verify=False, timeout=30) as c:
            r = await c.post("https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {t}"},
                json={"model":"GigaChat","messages":[{"role":"user","content":f"Ты — дизайнер. Кратко: {q}"}],"max_tokens":400})
            return r.json()["choices"][0]["message"]["content"].strip()
    except: return "⚠️ Ошибка ИИ"

def _mkb(role=None):
    if role=="manager":
        return InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🏠 Пройти квиз", web_app=WebAppInfo(url=FRONTEND_URL))],
            [InlineKeyboardButton(text="📊 Мои заявки", callback_data="my_requests")],
            [InlineKeyboardButton(text="💡 ИИ-советник", callback_data="support")],
            [InlineKeyboardButton(text="ℹ️ О сервисе", callback_data="about")],
            [InlineKeyboardButton(text="👥 Команда", callback_data="team")]])
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏠 Пройти квиз", web_app=WebAppInfo(url=FRONTEND_URL))],
        [InlineKeyboardButton(text="💡 ИИ-советник", callback_data="support")],
        [InlineKeyboardButton(text="📋 Мои заявки", callback_data="my_requests")],
        [InlineKeyboardButton(text="ℹ️ О сервисе", callback_data="about")]])

def _bkb(role=None):
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Главное меню", callback_data="back")]])

class Reg(StatesGroup):
    name = State(); phone = State()
class Quiz(StatesGroup):
    name = State(); phone = State(); room = State(); style = State(); budget = State(); comment = State()
class Sup(StatesGroup):
    waiting = State()

@dp.message(CommandStart())
async def onStart(m: Message):
    r = _role(m.from_user.id)
    if r:
        await m.answer(f"👋 Привет, <b>{m.from_user.full_name}</b>!\nРоль: {'👔 Менеджер' if r=='manager' else '🛒 Заказчик'}\n\n🌐 {FRONTEND_URL}", reply_markup=_mkb(r), parse_mode="HTML")
    else:
        await m.answer("👋 Добро пожаловать в <b>Interio</b>!\nВыберите роль:", reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="👔 Менеджер", callback_data="role:manager")],
            [InlineKeyboardButton(text="🛒 Заказчик", callback_data="role:customer")]]), parse_mode="HTML")

@dp.callback_query(F.data.startswith("role:"))
async def onRole(cb: CallbackQuery, s: FSMContext):
    role = cb.data.split(":",1)[1]
    await s.update_data(chosen_role=role)
    await cb.message.answer(f"Вы выбрали: <b>{'👔 Менеджер' if role=='manager' else '🛒 Заказчик'}</b>\nВведите имя:", parse_mode="HTML")
    await s.set_state(Reg.name)
    try: await cb.answer()
    except: pass

@dp.message(Reg.name)
async def regName(m: Message, s: FSMContext):
    await s.update_data(name=m.text.strip())
    await s.set_state(Reg.phone)
    await m.answer("📱 Введите телефон (например +79991234567):", parse_mode="HTML")

@dp.message(Reg.phone)
async def regPhone(m: Message, s: FSMContext):
    ph = m.text.strip()
    if len("".join(c for c in ph if c.isdigit())) < 10:
        await m.answer("❌ Введите корректный номер:"); return
    d = await s.get_data(); name = d.get("name", m.from_user.full_name); role = d.get("chosen_role", "customer")
    _set(m.from_user.id, name, ph, role)
    extra = "\n📊 Вы будете получать уведомления о новых заявках." if role=="manager" else ""
    await m.answer(f"✅ Готово!\nРоль: {'👔 Менеджер' if role=='manager' else '🛒 Заказчик'}\nИмя: {name}\nТелефон: {ph}{extra}", reply_markup=_mkb(role), parse_mode="HTML")
    await s.clear()

@dp.callback_query(F.data == "back")
async def onBack(cb: CallbackQuery):
    r = _role(cb.from_user.id)
    await cb.message.answer("🏠 Главное меню <b>Interio</b>", reply_markup=_mkb(r), parse_mode="HTML")
    try: await cb.answer()
    except: pass

@dp.callback_query(F.data == "about")
async def onAbout(cb: CallbackQuery):
    r = _role(cb.from_user.id)
    await cb.message.answer("ℹ️ <b>Interio</b> — онлайн-студия дизайна интерьеров\n\n🌐 " + FRONTEND_URL, reply_markup=_bkb(r), parse_mode="HTML")
    try: await cb.answer()
    except: pass

@dp.callback_query(F.data == "team")
async def onTeam(cb: CallbackQuery):
    if _role(cb.from_user.id) != "manager":
        await cb.answer("Только для менеджеров", show_alert=True); return
    u = _load(); mgrs = [x for x in u.values() if x.get("role")=="manager"]; cust = [x for x in u.values() if x.get("role")=="customer"]
    t = f"👥 <b>Команда</b>\n👔 Менеджеры: {len(mgrs)}\n"
    for m in mgrs: t += f"  • {m.get('name','?')}\n"
    t += f"\n🛒 Заказчики: {len(cust)}\n"
    for c in cust: t += f"  • {c.get('name','?')}\n"
    await cb.message.answer(t, reply_markup=_bkb(), parse_mode="HTML")
    try: await cb.answer()
    except: pass

@dp.callback_query(F.data == "my_requests")
async def onMy(cb: CallbackQuery):
    r = _role(cb.from_user.id)
    await cb.message.answer("📋 <b>Мои заявки</b>\n\nОткройте сайт:", reply_markup=InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🌐 Открыть сайт", web_app=WebAppInfo(url=FRONTEND_URL))],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="back")]]), parse_mode="HTML")
    try: await cb.answer()
    except: pass

@dp.message(Command("quiz"))
async def onQuiz(m: Message, s: FSMContext):
    await s.clear(); await s.set_state(Quiz.name)
    await m.answer("👤 <b>Шаг 1/6</b>\nВаше имя:", parse_mode="HTML")

@dp.message(Quiz.name)
async def qN(m: Message, s: FSMContext):
    await s.update_data(name=m.text); await s.set_state(Quiz.phone)
    await m.answer("📱 <b>Шаг 2/6</b>\nТелефон:", parse_mode="HTML")

@dp.message(Quiz.phone)
async def qP(m: Message, s: FSMContext):
    await s.update_data(phone=m.text); await s.set_state(Quiz.room)
    rooms = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=r, callback_data=f"qr:{r}")] for r in ["Квартира","Частный дом","Офис","Коммерческое","Студия","Другое"]])
    await m.answer("🏠 <b>Шаг 3/6</b>\nТип помещения:", reply_markup=rooms, parse_mode="HTML")

@dp.callback_query(F.data.startswith("qr:"))
async def qR(cb: CallbackQuery, s: FSMContext):
    room = cb.data.split(":",1)[1]
    await s.update_data(room_type=room); await s.set_state(Quiz.style)
    styles = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=x, callback_data=f"qs:{x}")] for x in ["Современный","Минимализм","Скандинавский","Классика","Лофт","Неоклассика"]])
    await cb.message.answer("🎨 <b>Шаг 4/6</b>\nСтиль:", reply_markup=styles, parse_mode="HTML")
    try: await cb.answer()
    except: pass

@dp.callback_query(F.data.startswith("qs:"))
async def qS(cb: CallbackQuery, s: FSMContext):
    style = cb.data.split(":",1)[1]
    await s.update_data(style=style); await s.set_state(Quiz.budget)
    buds = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=x, callback_data=f"qb:{x}")] for x in ["До 500 000 ₽","500k – 1M ₽","1M – 2M ₽","От 2M ₽","Пока не знаю"]])
    await cb.message.answer("💰 <b>Шаг 5/6</b>\nБюджет:", reply_markup=buds, parse_mode="HTML")
    try: await cb.answer()
    except: pass

@dp.callback_query(F.data.startswith("qb:"))
async def qB(cb: CallbackQuery, s: FSMContext):
    budget = cb.data.split(":",1)[1]
    await s.update_data(budget=budget); await s.set_state(Quiz.comment)
    await cb.message.answer("💬 <b>Шаг 6/6</b>\nКомментарий (или «нет»):", parse_mode="HTML")

@dp.message(Quiz.comment)
async def qC(m: Message, s: FSMContext):
    d = await s.get_data()
    comment = m.text if m.text.lower() != "нет" else ""
    txt = f"🆕 <b>Новая заявка!</b>\n\n👤 {d.get('name','')}\n📱 {d.get('phone','')}\n🎨 {d.get('style','')}\n💰 {d.get('budget','')}\n🏢 {d.get('room_type','')}\n💬 {comment or '—'}"
    await _notify(txt)
    await m.answer("🎉 <b>Заявка отправлена!</b>", reply_markup=_mkb(_role(m.from_user.id)), parse_mode="HTML")
    await s.clear()

@dp.message(Command("support"))
@dp.callback_query(F.data == "support")
async def onSup(ev, s: FSMContext):
    await s.set_state(Sup.waiting)
    r = _role(ev.from_user.id) if hasattr(ev, 'from_user') else None
    msg = ev.message if hasattr(ev, 'message') and ev.message else ev
    await msg.answer("💡 <b>ИИ-советник</b>\n\nЗадайте вопрос о дизайне:", reply_markup=_bkb(r), parse_mode="HTML")
    if hasattr(ev, 'answer'):
        try: await ev.answer()
        except: pass

@dp.message(Sup.waiting)
async def supMsg(m: Message, s: FSMContext):
    thinking = await m.answer("🤔 Думаю...")
    answer = await _gcask(m.text)
    try: await thinking.delete()
    except: pass
    await m.answer(answer, reply_markup=_bkb(_role(m.from_user.id)))

@dp.message()
async def unknown(m: Message):
    await m.answer("🤔 Введите /start для меню", reply_markup=_mkb(_role(m.from_user.id)))

async def main():
    await bot.delete_webhook()
    logging.info("🤖 Бот запущен (polling)...")
    await dp.start_polling(bot, skip_updates=True)

if __name__ == "__main__":
    asyncio.run(main())
