"""
Interio — Платформа дизайн-проектов
FastAPI + SQLite + HTML/JS/CSS
"""
from fastapi import FastAPI, HTTPException, Request, Response, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import sqlite3
import hashlib
import secrets
import os
import re
import uuid
import base64
import json
import httpx
import time
from datetime import datetime
import uvicorn

# ────────── App Setup ──────────
app = FastAPI(title="Interio API", version="2.0.0")

app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = 'data.db'
UPLOAD_DIR = 'uploads'
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ────────── GigaChat Config ──────────
GIGACHAT_AUTH_KEY = os.getenv("GIGACHAT_AUTH_KEY", "")
GIGACHAT_TOKEN_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
GIGACHAT_API_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"
_cached_gigachat_token = None
_gigachat_token_expires = 0

DESIGN_TOPICS = [
    "дизайн", "интерьер", "ремонт", "стиль", "квартир", "комнат",
    "мебел", "отделк", "планировк", "освещен", "цвет", "материал",
    "бюджет", "стоимост", "площад", "помещен", "кухн", "спальн",
    "гостин", "ванн", "детск", "прихож", "кабинет", "балкон",
    "лофт", "минимализм", "скандинав", "классик", "современн",
    "штор", "пол", "потолок", "стен", "плитк", "ламинат", "паркет",
    "диван", "стол", "стул", "шкаф", "хранен", "декор", "текстил",
]

# ────────── Pydantic Models ──────────
class PhoneCheckRequest(BaseModel):
    phone: str

class LoginRequest(BaseModel):
    phone: str
    password: str

class RegisterRequest(BaseModel):
    phone: str
    nickname: str
    password: str

class SessionRequest(BaseModel):
    session_id: str

class QuizSubmissionRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    room_type: str
    zones: list
    area: int
    style: str
    budget: str
    comment: Optional[str] = None
    consent: bool

class GigaChatRequest(BaseModel):
    question: str

class GalleryDesign(BaseModel):
    title: str
    description: Optional[str] = ""
    style: str
    room: str
    budget: str

class CommentRequest(BaseModel):
    design_id: int
    text: str
    author_name: str

# ────────── Database ──────────
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE NOT NULL,
        nickname TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS quiz_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        room_type TEXT NOT NULL,
        zones TEXT NOT NULL,
        area INTEGER NOT NULL,
        style TEXT NOT NULL,
        budget TEXT NOT NULL,
        comment TEXT,
        consent BOOLEAN NOT NULL,
        share_link TEXT UNIQUE,
        user_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )''')
    # Галерея дизайнов
    c.execute('''CREATE TABLE IF NOT EXISTS gallery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        style TEXT,
        room TEXT,
        budget TEXT,
        image_url TEXT,
        author_name TEXT DEFAULT 'Аноним',
        likes_count INTEGER DEFAULT 0,
        views_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    # Лайки
    c.execute('''CREATE TABLE IF NOT EXISTS likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        design_id INTEGER NOT NULL,
        ip_address TEXT,
        session_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (design_id) REFERENCES gallery (id)
    )''')
    # Комментарии
    c.execute('''CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        design_id INTEGER NOT NULL,
        author_name TEXT NOT NULL,
        text TEXT NOT NULL,
        is_approved INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (design_id) REFERENCES gallery (id)
    )''')
    conn.commit()
    conn.close()
    print("✅ База данных инициализирована")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

# ────────── GigaChat ──────────
async def get_gigachat_token():
    global _cached_gigachat_token, _gigachat_token_expires
    if _cached_gigachat_token and time.time() < _gigachat_token_expires:
        return _cached_gigachat_token
    if not GIGACHAT_AUTH_KEY:
        return None
    credentials = base64.b64encode(GIGACHAT_AUTH_KEY.encode()).decode()
    headers = {"Authorization": f"Basic {credentials}", "RqUID": str(uuid.uuid4()), "Content-Type": "application/x-www-form-urlencoded"}
    try:
        async with httpx.AsyncClient(verify=False) as client:
            resp = await client.post(GIGACHAT_TOKEN_URL, headers=headers, data={"scope": "GIGACHAT_API_PERS"}, timeout=10)
            resp.raise_for_status()
            result = resp.json()
            _cached_gigachat_token = result.get("access_token")
            _gigachat_token_expires = time.time() + result.get("expires_at", 1800) - 60
            return _cached_gigachat_token
    except Exception as e:
        print(f"GigaChat token error: {e}")
        return None

def _is_design_topic(text: str) -> bool:
    t = text.lower()
    return any(topic in t for topic in DESIGN_TOPICS)

async def ask_gigachat(question: str) -> str:
    if not _is_design_topic(question):
        return "🏠 Я помогаю только с вопросами по дизайну интерьера! Спросите о стилях, материалах, планировке или бюджете."
    token = await get_gigachat_token()
    if not token:
        return f"🤖 GigaChat временно недоступен. Вот совет по вашему вопросу:\n\nДля создания гармоничного интерьера «{question[:30]}...» рекомендуем обратить внимание на сочетание текстур и освещения."
    try:
        async with httpx.AsyncClient(verify=False, timeout=15) as client:
            resp = await client.post(GIGACHAT_API_URL, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, json={"model": "GigaChat", "messages": [{"role": "user", "content": f"Ты — профессиональный дизайнер интерьера. Ответь кратко (2-4 предложения) на вопрос: {question}"}], "max_tokens": 300, "temperature": 0.7})
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"GigaChat error: {e}")
        return "⚠️ Ошибка ИИ-помощника. Попробуйте позже."

# ────────── Auth Routes ──────────
@app.post("/api/auth/check-phone")
async def check_phone(req: PhoneCheckRequest):
    phone = req.phone.strip()
    if not phone:
        raise HTTPException(400, "Номер телефона обязателен")
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT id FROM users WHERE phone = ?', (phone,))
    user = c.fetchone()
    conn.close()
    return {"exists": user is not None, "phone": phone}

@app.post("/api/auth/login")
async def login(req: LoginRequest, response: Response):
    phone = req.phone.strip()
    if not phone or not req.password:
        raise HTTPException(400, "Телефон и пароль обязательны")
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE phone = ? AND password_hash = ?', (phone, hash_password(req.password)))
    user = c.fetchone()
    conn.close()
    if user:
        session_id = secrets.token_hex(16)
        response.set_cookie(key="session_id", value=session_id, max_age=3600*24*7, httponly=True, samesite="lax")
        return {"success": True, "user": {"id": user["id"], "phone": user["phone"], "nickname": user["nickname"]}}
    raise HTTPException(401, "Неверный пароль")

@app.post("/api/auth/register")
async def register(req: RegisterRequest, response: Response):
    phone = req.phone.strip()
    nickname = req.nickname.strip()
    if not nickname:
        raise HTTPException(400, "Никнейм обязателен")
    if len(req.password) < 8 or not any(c.isalpha() for c in req.password):
        raise HTTPException(400, "Пароль: минимум 8 символов + буква")
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT id FROM users WHERE phone = ? OR nickname = ?', (phone, nickname))
    existing = c.fetchone()
    if existing:
        conn.close()
        if existing["phone"] == phone:
            raise HTTPException(409, "Телефон уже зарегистрирован")
        raise HTTPException(409, "Никнейм занят")
    c.execute('INSERT INTO users (phone, nickname, password_hash) VALUES (?, ?, ?)', (phone, nickname, hash_password(req.password)))
    user_id = c.lastrowid
    conn.commit()
    conn.close()
    session_id = secrets.token_hex(16)
    response.set_cookie(key="session_id", value=session_id, max_age=3600*24*7, httponly=True, samesite="lax")
    return {"success": True, "user": {"id": user_id, "phone": phone, "nickname": nickname}}

@app.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie(key="session_id")
    return {"success": True}

@app.get("/api/auth/current-user")
async def current_user(request: Request):
    session_id = request.cookies.get("session_id")
    return {"success": False, "user": None}

# ────────── Session Routes ──────────
@app.post("/api/session/save")
async def save_session(req: SessionRequest):
    return {"success": True, "message": "Сессия сохранена"}

@app.post("/api/session/data")
async def get_session(req: SessionRequest):
    return {"success": True, "session_id": req.session_id, "data": None}

# ────────── Quiz Routes ──────────
@app.post("/api/quiz/submit")
async def submit_quiz(req: QuizSubmissionRequest, background_tasks: BackgroundTasks):
    if not req.name or not req.phone:
        raise HTTPException(400, "Имя и телефон обязательны")
    if not req.room_type or not req.style or not req.budget:
        raise HTTPException(400, "Выберите помещение, стиль и бюджет")
    if not req.consent:
        raise HTTPException(400, "Необходимо согласие на обработку данных")
    phone_clean = re.sub(r'[^\d]', '', req.phone)
    if len(phone_clean) != 11 or not phone_clean.startswith(('7', '8')):
        raise HTTPException(400, "Некорректный телефон")
    normalized_phone = '+' + (phone_clean if phone_clean.startswith('7') else '7' + phone_clean[1:])
    share_link = secrets.token_urlsafe(12)
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT id FROM users WHERE phone = ?', (normalized_phone,))
    user_record = c.fetchone()
    user_id = user_record["id"] if user_record else None
    c.execute('''INSERT INTO quiz_submissions
        (name, phone, email, room_type, zones, area, style, budget, comment, consent, share_link, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (req.name, normalized_phone, req.email, req.room_type,
         ','.join(req.zones) if req.zones else '', req.area,
         req.style, req.budget, req.comment, req.consent, share_link, user_id))
    submission_id = c.lastrowid
    conn.commit()
    conn.close()
    print(f"✅ Заявка #{submission_id} сохранена")
    return {"success": True, "submission_id": submission_id, "share_link": share_link, "message": "Заявка сохранена"}

@app.get("/api/quiz/submissions")
async def get_submissions():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT qs.*, u.nickname as user_nickname FROM quiz_submissions qs LEFT JOIN users u ON qs.user_id = u.id ORDER BY qs.created_at DESC LIMIT 50')
    rows = c.fetchall()
    conn.close()
    return {"submissions": [dict(r) for r in rows]}

# ────────── Gallery Routes ──────────
@app.get("/api/gallery")
async def get_gallery(style: Optional[str] = None, room: Optional[str] = None, sort: str = "newest", page: int = 1, limit: int = 12):
    conn = get_db()
    c = conn.cursor()
    query = "SELECT * FROM gallery WHERE 1=1"
    params = []
    if style:
        query += " AND style = ?"
        params.append(style)
    if room:
        query += " AND room = ?"
        params.append(room)
    order = "ORDER BY created_at DESC" if sort == "newest" else "ORDER BY likes_count DESC"
    offset = (page - 1) * limit
    c.execute(f"{query} {order} LIMIT ? OFFSET ?", params + [limit, offset])
    designs = c.fetchall()
    conn.close()
    return {"designs": [dict(d) for d in designs], "page": page}

@app.get("/api/gallery/{design_id}")
async def get_design(design_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE gallery SET views_count = views_count + 1 WHERE id = ?", (design_id,))
    c.execute("SELECT * FROM gallery WHERE id = ?", (design_id,))
    design = c.fetchone()
    conn.commit()
    conn.close()
    if not design:
        raise HTTPException(404, "Дизайн не найден")
    return dict(design)

@app.post("/api/gallery/{design_id}/like")
async def toggle_like(design_id: int, request: Request):
    ip = request.client.host
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id FROM likes WHERE design_id = ? AND ip_address = ?", (design_id, ip))
    existing = c.fetchone()
    if existing:
        c.execute("DELETE FROM likes WHERE id = ?", (existing["id"],))
        c.execute("UPDATE gallery SET likes_count = MAX(0, likes_count - 1) WHERE id = ?", (design_id,))
        liked = False
    else:
        c.execute("INSERT INTO likes (design_id, ip_address) VALUES (?, ?)", (design_id, ip))
        c.execute("UPDATE gallery SET likes_count = likes_count + 1 WHERE id = ?", (design_id,))
        liked = True
    c.execute("SELECT likes_count FROM gallery WHERE id = ?", (design_id,))
    row = c.fetchone()
    conn.commit()
    conn.close()
    return {"liked": liked, "likes_count": row["likes_count"] if row else 0}

@app.post("/api/gallery/{design_id}/comment")
async def add_comment(design_id: int, req: CommentRequest):
    if not req.text.strip():
        raise HTTPException(400, "Комментарий пуст")
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO comments (design_id, author_name, text) VALUES (?, ?, ?)", (design_id, req.author_name or "Аноним", req.text))
    conn.commit()
    c.execute("SELECT * FROM comments WHERE id = ?", (c.lastrowid,))
    comment = c.fetchone()
    conn.close()
    return dict(comment)

@app.get("/api/gallery/{design_id}/comments")
async def get_comments(design_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM comments WHERE design_id = ? AND is_approved = 1 ORDER BY created_at DESC", (design_id,))
    comments = c.fetchall()
    conn.close()
    return {"comments": [dict(c) for c in comments]}

@app.post("/api/gallery/publish")
async def publish_design(req: GalleryDesign):
    """Публикация дизайна из заявки квиза"""
    conn = get_db()
    c = conn.cursor()
    c.execute('''INSERT INTO gallery (title, description, style, room, budget, image_url)
        VALUES (?, ?, ?, ?, ?, ?)''',
        (req.title, req.description, req.style, req.room, req.budget, "/static/images/modern.png"))
    design_id = c.lastrowid
    conn.commit()
    conn.close()
    return {"success": True, "design_id": design_id}

# ────────── GigaChat Support Route ──────────
@app.post("/api/support")
async def support(req: GigaChatRequest):
    answer = await ask_gigachat(req.question)
    return {"answer": answer}

# ────────── Pages ──────────
@app.get("/", response_class=HTMLResponse)
async def root():
    return FileResponse("templates/index.html")

@app.get("/quiz", response_class=HTMLResponse)
async def quiz_page():
    return FileResponse("templates/quiz.html")

@app.get("/gallery", response_class=HTMLResponse)
async def gallery_page():
    return FileResponse("templates/gallery.html")

@app.get("/result/{share_link}", response_class=HTMLResponse)
async def result_page(share_link: str):
    return FileResponse("templates/result.html")

# ────────── Startup ──────────
@app.on_event("startup")
async def startup():
    init_db()

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=5000, reload=True)
