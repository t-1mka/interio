"""
Interio — Смарт-квиз для дизайн-проекта
FastAPI + SQLite. Сохраняет оригинальный API из t-1mka/interio + дополнения.
"""
from fastapi import FastAPI, HTTPException, Request, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from typing import Optional, List
import sqlite3
import hashlib
import secrets
from datetime import datetime
import uvicorn
import os
import re
import base64
import uuid
import time
import httpx
import json

app = FastAPI(title="Interio API", version="2.0.0")

# Статические файлы (оригинал)
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS (оригинал + расширен)
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

# ═══════════════════════════════════════
# GigaChat конфигурация (функция 19)
# ═══════════════════════════════════════
GIGACHAT_AUTH_KEY = os.getenv("GIGACHAT_AUTH_KEY", "")
GIGACHAT_TOKEN_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
GIGACHAT_API_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"
_cached_gc_token = None
_gc_token_exp = 0

DESIGN_TOPICS = [
    "дизайн", "интерьер", "ремонт", "стиль", "квартир", "комнат",
    "мебел", "отделк", "планировк", "освещен", "цвет", "материал",
    "бюджет", "стоимост", "площад", "помещен", "кухн", "спальн",
    "гостин", "ванн", "детск", "прихож", "кабинет", "балкон",
    "лофт", "минимализм", "скандинав", "классик", "современн",
    "штор", "пол", "потолок", "стен", "плитк", "ламинат", "паркет",
    "диван", "стол", "стул", "шкаф", "хранен", "декор", "текстил",
    "interior", "design", "renovation", "furniture",
]

async def get_gc_token():
    global _cached_gc_token, _gc_token_exp
    if _cached_gc_token and time.time() < _gc_token_exp:
        return _cached_gc_token
    if not GIGACHAT_AUTH_KEY:
        return None
    cred = base64.b64encode(GIGACHAT_AUTH_KEY.encode()).decode()
    hdrs = {"Authorization": f"Basic {cred}", "RqUID": str(uuid.uuid4()), "Content-Type": "application/x-www-form-urlencoded"}
    try:
        async with httpx.AsyncClient(verify=False) as c:
            r = await c.post(GIGACHAT_TOKEN_URL, headers=hdrs, data={"scope": "GIGACHAT_API_PERS"}, timeout=10)
            r.raise_for_status()
            d = r.json()
            _cached_gc_token = d.get("access_token")
            _gc_token_exp = time.time() + d.get("expires_at", 1800) - 60
            return _cached_gc_token
    except Exception as e:
        print(f"GigaChat token error: {e}")
        return None

def _is_design_topic(t: str) -> bool:
    tl = t.lower()
    return any(w in tl for w in DESIGN_TOPICS)

async def ask_gigachat(question: str) -> str:
    if not _is_design_topic(question):
        return "🏠 Я помогаю только с вопросами по дизайну интерьера!"
    tok = await get_gc_token()
    if not tok:
        return f"🤖 ИИ временно недоступен. Совет: для «{question[:40]}...» обратите внимание на сочетание текстур и освещения."
    try:
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            r = await c.post(GIGACHAT_API_URL, headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
                json={"model": "GigaChat", "messages": [{"role": "user", "content": f"Ты — профессиональный дизайнер интерьера. Кратко (2-4 предложения) ответь: {question}"}], "max_tokens": 300, "temperature": 0.7})
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"GigaChat error: {e}")
        return "⚠️ Ошибка ИИ-помощника."

# ═══════════════════════════════════════
# Pydantic модели (оригинал + новые)
# ═══════════════════════════════════════
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

class AnalyticsEvent(BaseModel):
    event_type: str
    step_number: Optional[int] = None
    session_id: Optional[str] = None

class PortfolioPublish(BaseModel):
    title: str
    description: Optional[str] = ""
    scene_params: dict
    share_link: Optional[str] = None

class CommentCreate(BaseModel):
    design_id: int
    text: str
    author_name: str = "Аноним"

# ═══════════════════════════════════════
# База данных (оригинал + новые таблицы)
# ═══════════════════════════════════════
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Оригинальные таблицы
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT UNIQUE NOT NULL,
        nickname TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    c.execute('''CREATE TABLE IF NOT EXISTS quiz_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL,
        email TEXT, room_type TEXT NOT NULL, zones TEXT NOT NULL, area INTEGER NOT NULL,
        style TEXT NOT NULL, budget TEXT NOT NULL, comment TEXT, consent BOOLEAN NOT NULL,
        share_link TEXT UNIQUE, user_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id))''')
    # Новые таблицы
    c.execute('''CREATE TABLE IF NOT EXISTS portfolio (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT,
        scene_params TEXT, preview_image TEXT, style TEXT, room TEXT, budget TEXT,
        author_name TEXT DEFAULT 'Аноним', share_link TEXT,
        likes_count INTEGER DEFAULT 0, views_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    c.execute('''CREATE TABLE IF NOT EXISTS likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, design_id INTEGER NOT NULL,
        ip_address TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (design_id) REFERENCES portfolio (id))''')
    c.execute('''CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT, design_id INTEGER NOT NULL,
        author_name TEXT NOT NULL, text TEXT NOT NULL, is_approved INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (design_id) REFERENCES portfolio (id))''')
    c.execute('''CREATE TABLE IF NOT EXISTS analytics_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT, step_number INTEGER,
        session_id TEXT, ip_address TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()
    conn.close()
    print("✅ База данных инициализирована")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(p):
    return hashlib.sha256(p.encode()).hexdigest()

# ═══════════════════════════════════════
# ORIGINAL API: Auth (без изменений)
# ═══════════════════════════════════════
@app.on_event("startup")
async def startup_event():
    init_db()

@app.post("/api/auth/check-phone")
async def check_phone(request: PhoneCheckRequest):
    phone = request.phone.strip()
    if not phone:
        raise HTTPException(400, "Номер телефона обязателен")
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT id FROM users WHERE phone = ?', (phone,))
    user = c.fetchone()
    conn.close()
    return {"exists": user is not None, "phone": phone}

@app.post("/api/auth/login")
async def login(request: LoginRequest, response: Response):
    phone = request.phone.strip()
    if not phone or not request.password:
        raise HTTPException(400, "Телефон и пароль обязательны")
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE phone = ? AND password_hash = ?', (phone, hash_password(request.password)))
    user = c.fetchone()
    conn.close()
    if user:
        session_id = secrets.token_hex(16)
        response.set_cookie(key="session_id", value=session_id, max_age=3600*24*7, httponly=True, samesite="lax")
        return {"success": True, "user": {"id": user["id"], "phone": user["phone"], "nickname": user["nickname"]}}
    raise HTTPException(401, "Неверный пароль")

@app.post("/api/auth/register")
async def register(request: RegisterRequest, response: Response):
    phone = request.phone.strip()
    nickname = request.nickname.strip()
    if not nickname:
        raise HTTPException(400, "Никнейм обязателен")
    if len(request.password) < 8 or not any(ch.isalpha() for ch in request.password):
        raise HTTPException(400, "Пароль: мин. 8 символов + буква")
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT id FROM users WHERE phone = ? OR nickname = ?', (phone, nickname))
    existing = c.fetchone()
    if existing:
        conn.close()
        if existing["phone"] == phone:
            raise HTTPException(409, "Телефон уже зарегистрирован")
        raise HTTPException(409, "Никнейм занят")
    c.execute('INSERT INTO users (phone, nickname, password_hash) VALUES (?, ?, ?)', (phone, nickname, hash_password(request.password)))
    uid = c.lastrowid
    conn.commit()
    conn.close()
    session_id = secrets.token_hex(16)
    response.set_cookie(key="session_id", value=session_id, max_age=3600*24*7, httponly=True, samesite="lax")
    return {"success": True, "user": {"id": uid, "phone": phone, "nickname": nickname}}

@app.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie(key="session_id")
    return {"success": True}

@app.get("/api/auth/current-user")
async def current_user(request: Request):
    return {"success": False, "user": None}

@app.get("/api/auth/users")
async def get_users():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT id, phone, nickname, created_at FROM users ORDER BY created_at DESC')
    users = c.fetchall()
    conn.close()
    return {"users": [dict(u) for u in users]}

# ═══════════════════════════════════════
# ORIGINAL API: Session (без изменений)
# ═══════════════════════════════════════
@app.post("/api/session/data")
async def get_session_data(request: SessionRequest):
    return {"success": True, "session_id": request.session_id, "data": None}

@app.post("/api/session/save")
async def save_session_data(request: SessionRequest, http_request: Request):
    print(f"Сохранение сессии: {request.session_id}")
    return {"success": True, "message": "Данные сессии сохранены"}

# ═══════════════════════════════════════
# ORIGINAL API: Quiz (расширен share_link)
# ═══════════════════════════════════════
@app.post("/api/quiz/submit")
async def submit_quiz(request: QuizSubmissionRequest, http_request: Request):
    if not request.name or not request.phone:
        raise HTTPException(400, "Имя и телефон обязательны")
    if not request.room_type or not request.style or not request.budget:
        raise HTTPException(400, "Выберите помещение, стиль и бюджет")
    if not request.consent:
        raise HTTPException(400, "Необходимо согласие")
    phone_clean = re.sub(r'[^\d]', '', request.phone)
    if len(phone_clean) != 11 or not phone_clean.startswith(('7', '8')):
        raise HTTPException(400, "Некорректный телефон")
    normalized = '+' + (phone_clean if phone_clean.startswith('7') else '7' + phone_clean[1:])
    share_link = secrets.token_urlsafe(12)
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT id FROM users WHERE phone = ?', (normalized,))
    ur = c.fetchone()
    uid = ur["id"] if ur else None
    c.execute('''INSERT INTO quiz_submissions
        (name, phone, email, room_type, zones, area, style, budget, comment, consent, share_link, user_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''',
        (request.name, normalized, request.email, request.room_type,
         ','.join(request.zones) if request.zones else '', request.area,
         request.style, request.budget, request.comment, request.consent, share_link, uid))
    sid = c.lastrowid
    conn.commit()
    conn.close()
    print(f"✅ Заявка #{sid} сохранена")
    return {"success": True, "submission_id": sid, "share_link": share_link, "message": "Заявка сохранена"}

@app.get("/api/quiz/submissions")
async def get_quiz_submissions():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT qs.*, u.nickname as user_nickname FROM quiz_submissions qs LEFT JOIN users u ON qs.user_id = u.id ORDER BY qs.created_at DESC LIMIT 50')
    subs = c.fetchall()
    conn.close()
    return {"submissions": [dict(s) for s in subs]}

@app.get("/api/quiz/user-submissions")
async def get_user_submissions(request: Request):
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT qs.*, u.nickname as user_nickname FROM quiz_submissions qs LEFT JOIN users u ON qs.user_id = u.id ORDER BY qs.created_at DESC LIMIT 20')
    subs = c.fetchall()
    conn.close()
    return {"success": True, "submissions": [dict(s) for s in subs]}

# ═══════════════════════════════════════
# NEW API: GigaChat support (функция 19)
# ═══════════════════════════════════════
@app.post("/api/support")
async def support(req: GigaChatRequest):
    answer = await ask_gigachat(req.question)
    return {"answer": answer}

# ═══════════════════════════════════════
# NEW API: Analytics (функции 38-39)
# ═══════════════════════════════════════
@app.post("/api/analytics")
async def log_analytics(req: AnalyticsEvent, request: Request):
    conn = get_db()
    c = conn.cursor()
    c.execute('INSERT INTO analytics_events (event_type, step_number, session_id, ip_address) VALUES (?,?,?,?)',
        (req.event_type, req.step_number, req.session_id, request.client.host))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.get("/api/analytics/heatmap")
async def get_heatmap():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT step_number, COUNT(*) as cnt FROM analytics_events WHERE event_type="quiz_step_exit" AND step_number IS NOT NULL GROUP BY step_number ORDER BY step_number')
    rows = c.fetchall()
    conn.close()
    return {"heatmap": {f"step_{r['step_number']}": r["cnt"] for r in rows}}

# ═══════════════════════════════════════
# NEW API: Portfolio (функции 27-30)
# ═══════════════════════════════════════
@app.get("/api/portfolio")
async def get_portfolio(style: Optional[str] = None, budget: Optional[str] = None, room: Optional[str] = None, sort: str = "newest", page: int = 1, limit: int = 12):
    conn = get_db()
    c = conn.cursor()
    q = "SELECT * FROM portfolio WHERE 1=1"
    p = []
    if style: q += " AND style = ?"; p.append(style)
    if budget: q += " AND budget = ?"; p.append(budget)
    if room: q += " AND room = ?"; p.append(room)
    order = "ORDER BY created_at DESC" if sort == "newest" else "ORDER BY likes_count DESC"
    c.execute(f"{q} {order} LIMIT ? OFFSET ?", p + [limit, (page-1)*limit])
    designs = c.fetchall()
    conn.close()
    return {"designs": [dict(d) for d in designs], "page": page}

@app.get("/api/portfolio/{design_id}")
async def get_portfolio_design(design_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE portfolio SET views_count = views_count + 1 WHERE id = ?", (design_id,))
    c.execute("SELECT * FROM portfolio WHERE id = ?", (design_id,))
    d = c.fetchone()
    conn.commit()
    conn.close()
    if not d:
        raise HTTPException(404, "Дизайн не найден")
    return dict(d)

@app.post("/api/portfolio/{design_id}/like")
async def toggle_like_portfolio(design_id: int, request: Request):
    ip = request.client.host
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id FROM likes WHERE design_id = ? AND ip_address = ?", (design_id, ip))
    existing = c.fetchone()
    if existing:
        c.execute("DELETE FROM likes WHERE id = ?", (existing["id"],))
        c.execute("UPDATE portfolio SET likes_count = MAX(0, likes_count - 1) WHERE id = ?", (design_id,))
        liked = False
    else:
        c.execute("INSERT INTO likes (design_id, ip_address) VALUES (?, ?)", (design_id, ip))
        c.execute("UPDATE portfolio SET likes_count = likes_count + 1 WHERE id = ?", (design_id,))
        liked = True
    c.execute("SELECT likes_count FROM portfolio WHERE id = ?", (design_id,))
    row = c.fetchone()
    conn.commit()
    conn.close()
    return {"liked": liked, "likes_count": row["likes_count"] if row else 0}

@app.post("/api/portfolio/{design_id}/comment")
async def add_comment(design_id: int, req: CommentCreate):
    if not req.text.strip():
        raise HTTPException(400, "Комментарий пуст")
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO comments (design_id, author_name, text) VALUES (?,?,?)", (design_id, req.author_name, req.text))
    conn.commit()
    c.execute("SELECT * FROM comments WHERE id = ?", (c.lastrowid,))
    comment = c.fetchone()
    conn.close()
    return dict(comment)

@app.get("/api/portfolio/{design_id}/comments")
async def get_comments(design_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM comments WHERE design_id = ? AND is_approved = 1 ORDER BY created_at DESC", (design_id,))
    comments = c.fetchall()
    conn.close()
    return {"comments": [dict(c) for c in comments]}

@app.post("/api/portfolio/publish")
async def publish_design(req: PortfolioPublish):
    params_json = json.dumps(req.scene_params, ensure_ascii=False)
    conn = get_db()
    c = conn.cursor()
    c.execute('''INSERT INTO portfolio (title, description, scene_params, style, room, budget, share_link, preview_image)
        VALUES (?,?,?,?,?,?,?,?)''',
        (req.title, req.description, params_json,
         req.scene_params.get("style", ""), req.scene_params.get("room_type", ""),
         req.scene_params.get("budget", ""), req.share_link, ""))
    pid = c.lastrowid
    conn.commit()
    conn.close()
    return {"success": True, "design_id": pid}

# ═══════════════════════════════════════
# ORIGINAL API: Pages (без изменений)
# ═══════════════════════════════════════
@app.get("/", response_class=HTMLResponse)
async def root():
    return FileResponse("templates/index.html")

@app.get("/quiz", response_class=HTMLResponse)
async def quiz():
    return FileResponse("templates/quiz.html")

@app.get("/result/{share_link}", response_class=HTMLResponse)
async def result_page(share_link: str):
    return FileResponse("templates/result.html")

@app.get("/portfolio", response_class=HTMLResponse)
async def portfolio_page():
    return FileResponse("templates/portfolio.html")

@app.get("/design/{design_id}", response_class=HTMLResponse)
async def design_page(design_id: int):
    return FileResponse("templates/design.html")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=5000, reload=True)
