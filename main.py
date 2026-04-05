"""
Interio — Unified Entry Point for Render
Запускает: FastAPI сервер + Telegram Bot (polling)
"""
from dotenv import load_dotenv
load_dotenv()

import os
import asyncio
import logging
import json
import re
import hashlib
import secrets
import time
import smtplib
import uuid
from email.message import EmailMessage

import httpx
from fastapi import FastAPI, HTTPException, Request, Response, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from typing import Optional, List

import sqlite3

# ═══════════════════════════════════════════
# App
# ═══════════════════════════════════════════
app = FastAPI(title="Interio")

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=True)

# ═══════════════════════════════════════════
# Config
# ═══════════════════════════════════════════
DB_PATH = os.getenv("DATABASE_URL", "data.db")
if DB_PATH.startswith("sqlite"):
    DB_PATH = DB_PATH.split("///")[-1]
    if DB_PATH.startswith("/"): DB_PATH = DB_PATH[1:]
if not DB_PATH.endswith(".db"): DB_PATH = "data.db"

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

GIGACHAT_KEY = os.getenv("GIGACHAT_AUTH_KEY", "")
GC_TOKEN, GC_EXP = None, 0

TG_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TG_CHAT = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
TG_API = f"https://api.telegram.org/bot{TG_TOKEN}" if TG_TOKEN else ""

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "interiopersonal@gmail.com")
SMTP_PASS = os.getenv("SMTP_PASS", "")

ADMIN_CODE = "admin123"

# ═══════════════════════════════════════════
# Bot imports (aiogram)
# ═══════════════════════════════════════════
_bot_app = None
try:
    from aiogram import Bot, Dispatcher, F
    from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
    from aiogram.filters import CommandStart, Command
    from aiogram.fsm.context import FSMContext
    from aiogram.fsm.state import State, StatesGroup
    from aiogram.fsm.storage.memory import MemoryStorage
    _bot_app = True
except ImportError:
    pass

# ═══════════════════════════════════════════
# DB
# ═══════════════════════════════════════════
def init_db():
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT UNIQUE NOT NULL,
        nickname TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user', avatar_url TEXT DEFAULT '', bio TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    try: c.execute('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "user"')
    except: pass
    c.execute('''CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, session_token TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL)''')
    c.execute('''CREATE TABLE IF NOT EXISTS quiz_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL,
        email TEXT, room_type TEXT NOT NULL, zones TEXT NOT NULL, area INTEGER NOT NULL,
        style TEXT NOT NULL, budget TEXT NOT NULL, comment TEXT, consent BOOLEAN NOT NULL,
        share_link TEXT UNIQUE, user_id INTEGER, photo_urls TEXT,
        status TEXT DEFAULT 'new', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    try: c.execute('ALTER TABLE quiz_submissions ADD COLUMN status TEXT DEFAULT "new"')
    except: pass
    c.execute('''CREATE TABLE IF NOT EXISTS portfolio (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT,
        scene_params TEXT, style TEXT, room TEXT, budget TEXT,
        likes_count INTEGER DEFAULT 0, views_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    c.execute('''CREATE TABLE IF NOT EXISTS likes (id INTEGER PRIMARY KEY AUTOINCREMENT, design_id INTEGER NOT NULL, ip_address TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, design_id INTEGER NOT NULL, author_name TEXT NOT NULL, text TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit(); conn.close()
    print("Database ready")

def get_db():
    conn = sqlite3.connect(DB_PATH); conn.row_factory = sqlite3.Row; return conn
def hash_pw(p): return hashlib.sha256(p.encode()).hexdigest()
def validate_password(p):
    if len(p) < 8: raise HTTPException(400, "Пароль мин. 8 символов")
    if not any(c.isalpha() for c in p): raise HTTPException(400, "Пароль должен содержать букву")
    return p
def create_session(cursor, uid):
    tok = secrets.token_hex(16); exp = int(time.time()) + 3600*24*7
    cursor.execute('INSERT INTO sessions (session_token,user_id,expires_at) VALUES (?,?,?)', (tok, uid, exp))
    return tok
def set_cookie(resp, tok):
    resp.set_cookie(key="session_id", value=tok, max_age=3600*24*7, httponly=True, samesite="lax", path="/")

def get_admin_user(request: Request):
    tok = request.cookies.get("admin_session")
    return {"id": 0, "nickname": "Admin", "role": "admin"} if tok else None

def send_quiz_email(recipient_email: str, data):
    if not recipient_email: return
    try:
        content = f"Заявка на дизайн-проект\n========================\n\nИмя: {data.name}\nТелефон: {data.phone}\nEmail: {data.email}\nТип: {data.room_type}\nЗоны: {', '.join(data.zones) if data.zones else '—'}\nПлощадь: {data.area} м²\nСтиль: {data.style}\nБюджет: {data.budget}\n"
        if data.comment: content += f"Коммент: {data.comment}\n"
        msg = EmailMessage(); msg['Subject'] = 'Interio — ваши ответы'; msg['From'] = SMTP_USER; msg['To'] = recipient_email
        msg.set_content(f"Здравствуйте, {data.name}!\n\nОтветы во вложении.\n\nКоманда Interio")
        msg.add_attachment(content.encode('utf-8'), maintype='text', subtype='plain', charset='utf-8', filename='interio_preferences.txt')
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as srv: srv.login(SMTP_USER, SMTP_PASS); srv.send_message(msg)
        print(f"Email sent to {recipient_email}")
    except Exception as e: print(f"Email error: {e}")

async def notify_tg(text):
    if not TG_API or not TG_CHAT: return
    try:
        async with httpx.AsyncClient() as c: await c.post(f"{TG_API}/sendMessage", json={"chat_id": TG_CHAT, "text": text, "parse_mode": "HTML"}, timeout=10)
    except: pass

# ═══════════════════════════════════════════
# Models
# ═══════════════════════════════════════════
class PhoneCheck(BaseModel): phone: str
class LoginReq(BaseModel): phone: str; password: str
class RegisterReq(BaseModel): phone: str; nickname: str; password: str
class QuizSubmit(BaseModel):
    name: str; phone: str; email: str; room_type: str
    zones: list; area: int; style: str; budget: str
    comment: Optional[str] = None; consent: bool; photo_urls: list = []
class GigaChatReq(BaseModel): question: str
class CommentReq(BaseModel): design_id: int; text: str; author_name: str = "Anonim"
class TrackCode(BaseModel): phone: str; code: str
class ProfileUpdate(BaseModel): nickname: str; bio: str = ""; phone: str = ""
class AdminLogin(BaseModel): code: str

# ═══════════════════════════════════════════
# GigaChat
# ═══════════════════════════════════════════
DESIGN_WORDS = ["дизайн","интерьер","ремонт","стиль","квартир","комнат","мебел","отделк","планировк","освещен","цвет","бюджет","кухн","спальн","гостин","лофт","минимализм","скандинав","классик","диван","стол","шкаф","декор","interior","design","renovation","furniture","budget","room"]
def _is_design(t): return any(w in t.lower() for w in DESIGN_WORDS)

async def gc_token():
    global GC_TOKEN, GC_EXP
    if GC_TOKEN and time.time() < GC_EXP: return GC_TOKEN
    if not GIGACHAT_KEY: return None
    try:
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            r = await c.post("https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
                headers={"Authorization": f"Basic {GIGACHAT_KEY}", "RqUID": str(uuid.uuid4())},
                data={"scope": "GIGACHAT_API_PERS"})
            if r.status_code != 200: return None
            d = r.json(); GC_TOKEN = d.get("access_token"); exp = d.get("expires_at", 0)
            GC_EXP = (exp-60) if exp>1e9 else (time.time()+1740); return GC_TOKEN
    except: return None

async def gc_ask(q):
    if not _is_design(q): return "💡 Я помогаю только с вопросами по дизайну интерьера!"
    tok = await gc_token()
    if not tok: return "ИИ недоступен"
    try:
        async with httpx.AsyncClient(verify=False, timeout=30) as c:
            r = await c.post("https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {tok}"},
                json={"model":"GigaChat","messages":[{"role":"user","content":f"Ты — дизайнер. Кратко: {q}"}],"max_tokens":400})
            return r.json()["choices"][0]["message"]["content"].strip()
    except: return "Ошибка ИИ"

# ═══════════════════════════════════════════
# Pages
# ═══════════════════════════════════════════
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.get("/", response_class=HTMLResponse)
async def page_index(): return FileResponse(os.path.join(BASE_DIR, "templates/index.html"))
@app.get("/quiz", response_class=HTMLResponse)
async def page_quiz(): return FileResponse(os.path.join(BASE_DIR, "templates/quiz.html"))
@app.get("/result/{sl}", response_class=HTMLResponse)
async def page_result(sl: str): return FileResponse(os.path.join(BASE_DIR, "templates/result.html"))
@app.get("/portfolio", response_class=HTMLResponse)
async def page_portfolio(): return FileResponse(os.path.join(BASE_DIR, "templates/portfolio.html"))
@app.get("/design/{did}", response_class=HTMLResponse)
async def page_design(did: int): return FileResponse(os.path.join(BASE_DIR, "templates/design.html"))
@app.get("/track", response_class=HTMLResponse)
async def page_track(): return FileResponse(os.path.join(BASE_DIR, "templates/track.html"))
@app.get("/admin", response_class=HTMLResponse)
async def page_admin(): return FileResponse(os.path.join(BASE_DIR, "templates/admin.html"))
@app.get("/cabinet", response_class=HTMLResponse)
async def page_cabinet(): return FileResponse(os.path.join(BASE_DIR, "templates/cabinet.html"))
@app.get("/privacy", response_class=HTMLResponse)
async def page_privacy(): return FileResponse(os.path.join(BASE_DIR, "templates/privacy.html"))
@app.get("/terms", response_class=HTMLResponse)
async def page_terms(): return FileResponse(os.path.join(BASE_DIR, "templates/terms.html"))

# ═══════════════════════════════════════════
# API — Auth
# ═══════════════════════════════════════════
@app.post("/api/auth/check-phone")
async def auth_check_phone(req: PhoneCheck):
    conn = get_db(); c = conn.cursor(); c.execute("SELECT id FROM users WHERE phone=?", (req.phone.strip(),)); u = c.fetchone(); conn.close()
    return {"exists": u is not None, "phone": req.phone.strip()}

@app.post("/api/auth/login")
async def auth_login(req: LoginReq, resp: Response):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM users WHERE phone=? AND password_hash=?", (req.phone.strip(), hash_pw(req.password))); u = c.fetchone()
    if u:
        tok = create_session(c, u["id"]); conn.commit(); conn.close(); set_cookie(resp, tok)
        return {"success": True, "user": {"id": u["id"], "phone": u["phone"], "nickname": u["nickname"]}}
    conn.close(); raise HTTPException(401, "Неверный пароль")

@app.post("/api/auth/register")
async def auth_register(req: RegisterReq, resp: Response):
    pwd = validate_password(req.password); conn = get_db(); c = conn.cursor()
    c.execute("SELECT id,phone,nickname FROM users WHERE phone=? OR nickname=?", (req.phone.strip(), req.nickname.strip())); ex = c.fetchone()
    if ex:
        conn.close()
        if ex["phone"] == req.phone.strip(): raise HTTPException(409, "Телефон занят")
        raise HTTPException(409, "Никнейм занят")
    c.execute("INSERT INTO users (phone,nickname,password_hash) VALUES (?,?,?)", (req.phone.strip(), req.nickname.strip(), hash_pw(pwd)))
    uid = c.lastrowid; tok = create_session(c, uid); conn.commit(); conn.close(); set_cookie(resp, tok)
    return {"success": True, "user": {"id": uid, "phone": req.phone.strip(), "nickname": req.nickname.strip()}}

@app.post("/api/auth/logout")
async def auth_logout(request: Request, resp: Response):
    tok = request.cookies.get("session_id")
    if tok: conn = get_db(); c = conn.cursor(); c.execute("DELETE FROM sessions WHERE session_token=?", (tok,)); conn.commit(); conn.close()
    resp.delete_cookie(key="session_id", path="/"); return {"success": True}

@app.get("/api/auth/current-user")
async def auth_current(request: Request):
    tok = request.cookies.get("session_id")
    if not tok: return {"success": False, "user": None}
    now = int(time.time()); conn = get_db(); c = conn.cursor()
    c.execute("SELECT u.id,u.phone,u.nickname,u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.session_token=? AND s.expires_at>?", (tok, now)); r = c.fetchone(); conn.close()
    if r: return {"success": True, "user": {"id": r["id"], "phone": r["phone"], "nickname": r["nickname"], "role": r.get("role","user")}}
    return {"success": False, "user": None}

@app.post("/api/auth/admin-login")
async def admin_login(req: AdminLogin, resp: Response):
    if req.code != ADMIN_CODE: raise HTTPException(401, "Неверный код")
    resp.set_cookie(key="admin_session", value=secrets.token_hex(32), max_age=3600*24, httponly=True, path="/")
    return {"success": True, "message": "Доступ предоставлен"}

# ═══════════════════════════════════════════
# API — Quiz
# ═══════════════════════════════════════════
@app.post("/api/quiz/submit")
async def quiz_submit(req: QuizSubmit, background_tasks: BackgroundTasks):
    if not req.name or not req.phone or not req.email: raise HTTPException(400, "Имя, телефон, email обязательны")
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', req.email): raise HTTPException(400, "Некорректный email")
    if not req.room_type or not req.style or not req.budget: raise HTTPException(400, "Заполните все шаги")
    if not req.consent: raise HTTPException(400, "Нужно согласие")
    clean = re.sub(r'[^\d]', '', req.phone)
    if len(clean) != 11 or not clean.startswith(('7','8')): raise HTTPException(400, "Некорректный телефон")
    phone = '+' + (clean if clean.startswith('7') else '7' + clean[1:])
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT id FROM users WHERE phone=?", (phone,)); u = c.fetchone(); uid = u["id"] if u else None
    c.execute('''INSERT INTO quiz_submissions (name,phone,email,room_type,zones,area,style,budget,comment,consent,share_link,user_id,photo_urls)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        (req.name, phone, req.email, req.room_type, ','.join(req.zones) if req.zones else '', req.area, req.style, req.budget, req.comment, req.consent, secrets.token_urlsafe(12), uid, json.dumps(req.photo_urls or [])))
    sid = c.lastrowid; conn.commit(); conn.close()
    txt = f"🆕 <b>Новая заявка!</b>\n\n👤 {req.name}\n📱 {phone}\n🎨 {req.style}\n💰 {req.budget}\n🏢 {req.room_type}\n💬 {req.comment or '—'}"
    asyncio.create_task(notify_tg(txt))
    background_tasks.add_task(send_quiz_email, req.email, req)
    return {"success": True, "submission_id": sid}

@app.get("/api/quiz/submissions")
async def quiz_all():
    conn = get_db(); c = conn.cursor(); c.execute("SELECT * FROM quiz_submissions ORDER BY created_at DESC LIMIT 100"); subs = [dict(s) for s in c.fetchall()]; conn.close()
    return {"submissions": subs}

# ═══════════════════════════════════════════
# API — Admin
# ═══════════════════════════════════════════
@app.get("/api/admin/submissions")
async def get_admin_submissions(request: Request):
    if not get_admin_user(request): raise HTTPException(403, "Доступ запрещен")
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT qs.*,u.nickname as user_nickname FROM quiz_submissions qs LEFT JOIN users u ON qs.user_id=u.id ORDER BY qs.created_at DESC LIMIT 100")
    subs = [dict(s) for s in c.fetchall()]; conn.close()
    return {"success": True, "submissions": subs}

@app.put("/api/admin/submissions/{sid}")
async def update_status(sid: int, request: Request, body: dict):
    if not get_admin_user(request): raise HTTPException(403, "Доступ запрещен")
    ns = body.get("status")
    if ns not in ["new","contacted","in_progress","completed","cancelled"]: raise HTTPException(400, "Неверный статус")
    conn = get_db(); c = conn.cursor(); c.execute("UPDATE quiz_submissions SET status=? WHERE id=?", (ns, sid))
    if c.rowcount == 0: conn.close(); raise HTTPException(404, "Не найдено")
    conn.commit(); conn.close()
    return {"success": True}

# ═══════════════════════════════════════════
# API — Support, Track, Portfolio, Profile, Upload
# ═══════════════════════════════════════════
@app.post("/api/support")
async def support(req: GigaChatReq): return {"answer": await gc_ask(req.question)}

@app.post("/api/track/request-code")
async def track_req(req: PhoneCheck):
    import random; code = str(random.randint(1000,9999)); print(f"Code for {req.phone}: {code}")
    return {"success": True, "demo_code": code}

@app.post("/api/track/verify")
async def track_ver(req: TrackCode):
    conn = get_db(); c = conn.cursor(); clean = re.sub(r'[^\d]','',req.phone); norm='+'+(clean if clean.startswith('7') else '7'+clean[1:])
    c.execute("SELECT * FROM quiz_submissions WHERE phone=? ORDER BY created_at DESC", (norm,)); subs=[dict(s) for s in c.fetchall()]; conn.close()
    return {"success": True, "submissions": subs}

@app.get("/api/portfolio")
async def portfolio_list(style: str = None):
    conn = get_db(); c = conn.cursor()
    if style: c.execute("SELECT * FROM portfolio WHERE style=? ORDER BY created_at DESC", (style,))
    else: c.execute("SELECT * FROM portfolio ORDER BY created_at DESC")
    d=[dict(x) for x in c.fetchall()]; conn.close(); return {"designs": d}

@app.get("/api/portfolio/{did}")
async def portfolio_view(did: int):
    conn = get_db(); c = conn.cursor(); c.execute("UPDATE portfolio SET views_count=views_count+1 WHERE id=?", (did,))
    c.execute("SELECT * FROM portfolio WHERE id=?", (did,)); r=c.fetchone(); conn.commit(); conn.close()
    if not r: raise HTTPException(404, "Not found"); return dict(r)

@app.post("/api/portfolio/{did}/like")
async def portfolio_like(did: int, request: Request):
    ip = request.client.host; conn = get_db(); c = conn.cursor()
    c.execute("SELECT id FROM likes WHERE design_id=? AND ip_address=?", (did, ip)); ex = c.fetchone()
    if ex: c.execute("DELETE FROM likes WHERE id=?", (ex["id"],)); c.execute("UPDATE portfolio SET likes_count=MAX(0,likes_count-1) WHERE id=?", (did,)); liked=False
    else: c.execute("INSERT INTO likes (design_id,ip_address) VALUES (?,?)", (did,ip)); c.execute("UPDATE portfolio SET likes_count=likes_count+1 WHERE id=?", (did,)); liked=True
    c.execute("SELECT likes_count FROM portfolio WHERE id=?", (did,)); r=c.fetchone(); conn.commit(); conn.close()
    return {"liked": liked, "likes_count": r["likes_count"] if r else 0}

@app.post("/api/portfolio/{did}/comment")
async def portfolio_comment(did: int, req: CommentReq):
    if not req.text.strip(): raise HTTPException(400, "Empty")
    conn = get_db(); c = conn.cursor(); c.execute("INSERT INTO comments (design_id,author_name,text) VALUES (?,?,?)", (did, req.author_name, req.text))
    conn.commit(); c.execute("SELECT * FROM comments WHERE id=?", (c.lastrowid,)); r=c.fetchone(); conn.close(); return dict(r)

@app.get("/api/portfolio/{did}/comments")
async def portfolio_comments(did: int):
    conn = get_db(); c = conn.cursor(); c.execute("SELECT * FROM comments WHERE design_id=? ORDER BY created_at DESC", (did,)); cms=[dict(c) for c in c.fetchall()]; conn.close()
    return {"comments": cms}

@app.post("/api/profile/update")
async def profile_update(req: ProfileUpdate, resp: Response):
    conn = get_db(); c = conn.cursor(); c.execute("UPDATE users SET nickname=?, bio=? WHERE phone=?", (req.nickname, req.bio, req.phone)); conn.commit(); conn.close()
    return {"success": True}

@app.post("/api/profile/avatar")
async def profile_avatar(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 5*1024*1024: raise HTTPException(400, "Max 5MB")
    ext = file.filename.rsplit(".",1)[-1] if "." in file.filename else "jpg"
    name = f"avatar_{secrets.token_hex(8)}.{ext}"
    with open(os.path.join(UPLOAD_DIR, name), "wb") as f: f.write(content)
    return {"success": True, "url": f"/uploads/{name}"}

@app.get("/api/profile/submissions/{phone}")
async def profile_subs(phone: str):
    conn = get_db(); c = conn.cursor(); c.execute("SELECT * FROM quiz_submissions WHERE phone=? ORDER BY created_at DESC", (phone,)); subs=[dict(s) for s in c.fetchall()]; conn.close()
    return {"submissions": subs}

@app.post("/api/upload-photo")
async def upload_photo(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"): raise HTTPException(400, "Only images")
    content = await file.read()
    if len(content) > 5*1024*1024: raise HTTPException(400, "Max 5MB")
    ext = file.filename.rsplit(".",1)[-1] if "." in file.filename else "jpg"
    name = f"{secrets.token_hex(8)}.{ext}"
    with open(os.path.join(UPLOAD_DIR, name), "wb") as f: f.write(content)
    return {"success": True, "url": f"/uploads/{name}"}

@app.get("/health")
async def health(): return {"status": "ok", "service": "interio"}

# ═══════════════════════════════════════════
# Telegram Bot (polling)
# ═══════════════════════════════════════════
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://interio-y5lf.onrender.com")
USERS_FILE = os.path.join(os.path.dirname(__file__), "bot", "data", "bot_users.json")

def _load_users():
    try:
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, "r", encoding="utf-8") as f: return json.load(f)
    except: pass
    return {}

def _save_users(users: dict):
    os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
    with open(USERS_FILE, "w", encoding="utf-8") as f: json.dump(users, f, ensure_ascii=False, indent=2)

def _get_role(tid): return _load_users().get(str(tid), {}).get("role")

def _set_role(tid, name, phone, role):
    u = _load_users(); u[str(tid)] = {"name": name, "phone": phone, "role": role, "tg_id": tid}; _save_users(u)

def _get_managers(): return [int(i) for i, u in _load_users().items() if u.get("role") == "manager"]

async def _notify_managers(text: str):
    if not bot: return
    for mid in _get_managers():
        try: await bot.send_message(mid, text, parse_mode="HTML")
        except Exception as e: logging.error(f"Bot notify error: {e}")

async def _gc_ask_bot(question):
    return await gc_ask(question)

def _main_kb(role=None):
    if role == "manager":
        return InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🏠 Пройти квиз", web_app=WebAppInfo(url=FRONTEND_URL))],
            [InlineKeyboardButton(text="📊 Мои заявки", callback_data="my_requests")],
            [InlineKeyboardButton(text="💡 ИИ-советник", callback_data="support")],
            [InlineKeyboardButton(text="ℹ️ О сервисе", callback_data="about")],
            [InlineKeyboardButton(text="👥 Команда", callback_data="team")],
        ])
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏠 Пройти квиз", web_app=WebAppInfo(url=FRONTEND_URL))],
        [InlineKeyboardButton(text="💡 ИИ-советник", callback_data="support")],
        [InlineKeyboardButton(text="📋 Мои заявки", callback_data="my_requests")],
        [InlineKeyboardButton(text="ℹ️ О сервисе", callback_data="about")],
    ])

_bot_started = False

async def start_bot():
    global _bot_started, bot, dp
    if _bot_started or not _bot_app or not TG_TOKEN:
        return
    _bot_started = True

    bot = Bot(token=TG_TOKEN)
    dp = Dispatcher(storage=MemoryStorage())

    # Ensure webhook is deleted before polling
    await bot.delete_webhook()
    logging.info("Webhook deleted, starting polling...")

    class RegState(StatesGroup):
        name = State(); phone = State()
    class QuizState2(StatesGroup):
        name = State(); phone = State(); room = State(); style = State(); budget = State(); comment = State()
    class SupportState2(StatesGroup):
        waiting = State()

    def role_kb():
        return InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="👔 Менеджер", callback_data="role:manager")],
            [InlineKeyboardButton(text="🛒 Заказчик", callback_data="role:customer")],
        ])
    def rooms(): return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=r, callback_data=f"qr:{r}")] for r in ["Квартира","Частный дом","Офис","Коммерческое","Студия","Другое"]])
    def styles(): return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=x, callback_data=f"qs:{x}")] for x in ["Современный","Минимализм","Скандинавский","Классика","Лофт","Неоклассика"]])
    def budgets(): return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=x, callback_data=f"qb:{x}")] for x in ["До 500 000 ₽","500k – 1M ₽","1M – 2M ₽","От 2M ₽","Пока не знаю"]])
    def bkb(role=None): return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Главное меню", callback_data="back")]])

    @dp.message(CommandStart())
    async def on_start(m: Message):
        role = _get_role(m.from_user.id)
        if role:
            rn = "👔 Менеджер" if role == "manager" else "🛒 Заказчик"
            await m.answer(f"👋 С возвращением, <b>{m.from_user.full_name}</b>!\n\nРоль: {rn}\n\n🌐 {FRONTEND_URL}", reply_markup=_main_kb(role), parse_mode="HTML")
        else:
            await m.answer("👋 Добро пожаловать в <b>Interio</b>!\n\nВыберите роль:", reply_markup=role_kb(), parse_mode="HTML")

    @dp.callback_query(F.data.startswith("role:"))
    async def on_role(cb: CallbackQuery, state: FSMContext):
        role = cb.data.split(":", 1)[1]
        await state.update_data(chosen_role=role)
        await cb.message.edit_text(f"Вы выбрали: <b>{'👔 Менеджер' if role=='manager' else '🛒 Заказчик'}</b>\n\nВведите имя:", parse_mode="HTML")
        await state.set_state(RegState.name)

    @dp.message(RegState.name)
    async def reg_n(m: Message, state: FSMContext):
        await state.update_data(name=m.text.strip())
        await state.set_state(RegState.phone)
        await m.answer("📱 Введите телефон (например +79991234567):", parse_mode="HTML")

    @dp.message(RegState.phone)
    async def reg_p(m: Message, state: FSMContext):
        phone = m.text.strip()
        if len("".join(c for c in phone if c.isdigit())) < 10:
            await m.answer("❌ Введите корректный номер:"); return
        data = await state.get_data()
        name = data.get("name", m.from_user.full_name)
        role = data.get("chosen_role", "customer")
        _set_role(m.from_user.id, name, phone, role)
        rn = "👔 Менеджер" if role == "manager" else "🛒 Заказчик"
        extra = "\n📊 Вы будете получать уведомления о новых заявках." if role == "manager" else ""
        await m.answer(f"✅ Регистрация завершена!\n\nРоль: {rn}\nИмя: {name}\nТелефон: {phone}{extra}", reply_markup=_main_kb(role), parse_mode="HTML")
        await state.clear()

    @dp.callback_query(F.data == "back")
    async def on_back(cb: CallbackQuery):
        role = _get_role(cb.from_user.id)
        await cb.message.answer("🏠 Главное меню <b>Interio</b>", reply_markup=_main_kb(role), parse_mode="HTML")
        try: await cb.answer()
        except: pass

    @dp.callback_query(F.data == "about")
    async def on_about(cb: CallbackQuery):
        role = _get_role(cb.from_user.id)
        txt = (
            "ℹ️ <b>Interio</b> — онлайн-студия дизайна интерьеров\n\n"
            "• Квиз из 6 шагов\n"
            "• Голосовой ввод ответов\n"
            "• Загрузка фото помещения\n"
            "• ИИ-советник (GigaChat)\n"
            "• Портфолио работ\n\n"
            f"🌐 {FRONTEND_URL}"
        )
        try: await cb.message.answer(txt, reply_markup=bkb(role), parse_mode="HTML")
        except Exception: pass
        try: await cb.answer()
        except: pass

    @dp.callback_query(F.data == "team")
    async def on_team(cb: CallbackQuery):
        if _get_role(cb.from_user.id) != "manager":
            await cb.answer("Только для менеджеров", show_alert=True); return
        users = _load_users()
        mgrs = [u for u in users.values() if u.get("role")=="manager"]
        cust = [u for u in users.values() if u.get("role")=="customer"]
        txt = f"👥 <b>Команда</b>\n\n👔 Менеджеры: {len(mgrs)}\n"
        for m in mgrs: txt += f"  • {m.get('name','?')}\n"
        txt += f"\n🛒 Заказчики: {len(cust)}\n"
        for c in cust: txt += f"  • {c.get('name','?')}\n"
        await cb.message.answer(txt, reply_markup=bkb(), parse_mode="HTML")
        try: await cb.answer()
        except: pass

    @dp.callback_query(F.data == "my_requests")
    async def on_my(cb: CallbackQuery):
        role = _get_role(cb.from_user.id)
        await cb.message.answer(
            "📋 <b>Мои заявки</b>\n\nОткройте сайт:",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="🌐 Открыть сайт", web_app=WebAppInfo(url=FRONTEND_URL))],
                [InlineKeyboardButton(text="🔙 Назад", callback_data="back")]]),
            parse_mode="HTML")
        try: await cb.answer()
        except: pass

    @dp.message(Command("quiz"))
    async def on_quiz(m: Message, state: FSMContext):
        await state.clear(); await state.set_state(QuizState2.name)
        await m.answer("👤 <b>Шаг 1/6</b>\n\nВаше имя:", parse_mode="HTML")

    @dp.message(QuizState2.name)
    async def q_name(m: Message, state: FSMContext):
        await state.update_data(name=m.text); await state.set_state(QuizState2.phone)
        await m.answer("📱 <b>Шаг 2/6</b>\n\nТелефон:", parse_mode="HTML")

    @dp.message(QuizState2.phone)
    async def q_phone(m: Message, state: FSMContext):
        await state.update_data(phone=m.text); await state.set_state(QuizState2.room)
        await m.answer("🏠 <b>Шаг 3/6</b>\n\nТип помещения:", reply_markup=rooms(), parse_mode="HTML")

    @dp.callback_query(F.data.startswith("qr:"))
    async def q_room(cb: CallbackQuery, state: FSMContext):
        room = cb.data.split(":",1)[1]
        await state.update_data(room_type=room); await state.set_state(QuizState2.style)
        await cb.message.answer("🎨 <b>Шаг 4/6</b>\n\nСтиль интерьера:", reply_markup=styles(), parse_mode="HTML")
        try: await cb.answer()
        except: pass

    @dp.callback_query(F.data.startswith("qs:"))
    async def q_style(cb: CallbackQuery, state: FSMContext):
        style = cb.data.split(":",1)[1]
        await state.update_data(style=style); await state.set_state(QuizState2.budget)
        await cb.message.answer("💰 <b>Шаг 5/6</b>\n\nБюджет:", reply_markup=budgets(), parse_mode="HTML")
        try: await cb.answer()
        except: pass

    @dp.callback_query(F.data.startswith("qb:"))
    async def q_budget(cb: CallbackQuery, state: FSMContext):
        budget = cb.data.split(":",1)[1]
        await state.update_data(budget=budget); await state.set_state(QuizState2.comment)
        await cb.message.answer("💬 <b>Шаг 6/6</b>\n\nКомментарий (или «нет»):", parse_mode="HTML")

    @dp.message(QuizState2.comment)
    async def q_comment(m: Message, state: FSMContext):
        d = await state.get_data()
        comment = m.text if m.text.lower() != "нет" else ""
        txt = f"🆕 <b>Новая заявка!</b>\n\n👤 {d.get('name','')}\n📱 {d.get('phone','')}\n🎨 {d.get('style','')}\n💰 {d.get('budget','')}\n🏢 {d.get('room_type','')}\n💬 {comment or '—'}"
        await _notify_managers(txt)
        await m.answer(f"🎉 <b>Заявка отправлена!</b>", reply_markup=_main_kb(_get_role(m.from_user.id)), parse_mode="HTML")
        await state.clear()

    @dp.message(Command("support"))
    @dp.callback_query(F.data == "support")
    async def on_support(ev, state: FSMContext):
        await state.set_state(SupportState2.waiting)
        role = _get_role(ev.from_user.id) if hasattr(ev, 'from_user') else None
        txt = (
            "💡 <b>ИИ-советник</b>\n\n"
            "Задайте вопрос о дизайне интерьера!\n\n"
            "Примеры:\n"
            "• Какой стиль для маленькой кухни?\n"
            "• Как выбрать цветовую гамму?\n"
            "• Какой бюджет на ремонт 60м²?"
        )
        msg = ev.message if hasattr(ev, 'message') and ev.message else ev
        await msg.answer(txt, reply_markup=bkb(role), parse_mode="HTML")
        if hasattr(ev, 'answer'):
            try: await ev.answer()
            except: pass

    @dp.message(SupportState2.waiting)
    async def support_msg(m: Message, state: FSMContext):
        thinking = await m.answer("🤔 Думаю...")
        answer = await _gc_ask_bot(m.text)
        try: await thinking.delete()
        except: pass
        await m.answer(answer, reply_markup=bkb(_get_role(m.from_user.id)))

    @dp.message()
    async def unknown(m: Message):
        await m.answer("🤔 Введите /start для меню", reply_markup=_main_kb(_get_role(m.from_user.id)))

    logging.info("🤖 Бот запущен в режиме polling...")
    await dp.start_polling(bot, skip_updates=True)

@app.on_event("startup")
async def startup():
    init_db()
    asyncio.create_task(start_bot())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
