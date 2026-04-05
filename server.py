"""
Interio Server - FastAPI + SQLite + GigaChat AI
"""
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Request, Response, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from typing import Optional, List
import sqlite3, hashlib, secrets, os, re, json, uuid, httpx, aiosmtplib, asyncio, time, smtplib
from email.message import EmailMessage

app = FastAPI(title="Interio API")

# Static files
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=True)

# Settings
DB_PATH = os.getenv("DATABASE_URL", "data.db")
if DB_PATH.startswith("sqlite"):
    DB_PATH = DB_PATH.split("///")[-1]
    if DB_PATH.startswith("/"): DB_PATH = DB_PATH[1:]
if not DB_PATH.endswith(".db") and not DB_PATH.endswith(".sqlite3"):
    DB_PATH = "data.db"

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# GigaChat
GIGACHAT_KEY = os.getenv("GIGACHAT_AUTH_KEY", "")
GC_TOKEN = None
GC_EXP = 0

# Telegram
TG_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TG_CHAT = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
TG_API = f"https://api.telegram.org/bot{TG_TOKEN}" if TG_TOKEN else ""

# Email
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "interiopersonal@gmail.com")
SMTP_PASS = os.getenv("SMTP_PASS", "")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "interiopersonal@gmail.com")

# Admin code
ADMIN_CODE = "admin123"

# Models
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
class SessionReq(BaseModel): session_id: str

# Database
def init_db():
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    
    # Users table with role
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE NOT NULL,
        nickname TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        avatar_url TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    try:
        c.execute('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "user"')
    except sqlite3.OperationalError:
        pass
    
    # Sessions table
    c.execute('''CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_token TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )''')
    
    # Quiz submissions with status
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
        photo_urls TEXT,
        status TEXT DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )''')
    try:
        c.execute('ALTER TABLE quiz_submissions ADD COLUMN status TEXT DEFAULT "new"')
    except sqlite3.OperationalError:
        pass
    
    c.execute('''CREATE TABLE IF NOT EXISTS portfolio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        scene_params TEXT,
        style TEXT,
        room TEXT,
        budget TEXT,
        likes_count INTEGER DEFAULT 0,
        views_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        design_id INTEGER NOT NULL,
        ip_address TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        design_id INTEGER NOT NULL,
        author_name TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    conn.commit(); conn.close()
    print("Database ready")

def get_db():
    conn = sqlite3.connect(DB_PATH); conn.row_factory = sqlite3.Row; return conn

def hash_pw(p): return hashlib.sha256(p.encode()).hexdigest()

def validate_password(password: str) -> str:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Пароль должен содержать минимум 8 символов")
    if not any(c.isalpha() for c in password):
        raise HTTPException(status_code=400, detail="Пароль должен содержать минимум одну букву")
    return password

def create_user_session(cursor, user_id: int) -> str:
    token = secrets.token_hex(16)
    expires_at = int(time.time()) + 3600 * 24 * 7
    cursor.execute(
        'INSERT INTO sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)',
        (token, user_id, expires_at),
    )
    return token

def set_session_cookie(response: Response, session_token: str) -> None:
    response.set_cookie(
        key="session_id",
        value=session_token,
        max_age=3600 * 24 * 7,
        httponly=True,
        samesite="lax",
        path="/",
    )

def get_current_admin_user(request: Request):
    session_token = request.cookies.get("session_id")
    if not session_token:
        return None
    now = int(time.time())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        '''SELECT u.id, u.phone, u.nickname, u.role FROM sessions s 
           JOIN users u ON s.user_id = u.id 
           WHERE s.session_token = ? AND s.expires_at > ?''',
        (session_token, now),
    )
    row = cursor.fetchone()
    conn.close()
    if row and row["role"] == "admin":
        return {"id": row["id"], "phone": row["phone"], "nickname": row["nickname"], "role": row["role"]}
    return None

# Email рассылка
def send_quiz_email(recipient_email: str, data):
    if not recipient_email:
        return
    try:
        content = f"Заявка на дизайн-проект\n"
        content += f"========================\n\n"
        content += f"Имя: {data.name}\n"
        content += f"Телефон: {data.phone}\n"
        content += f"Email: {data.email}\n"
        content += f"Тип помещения: {data.room_type}\n"
        content += f"Зоны: {', '.join(data.zones) if data.zones else 'Не указаны'}\n"
        content += f"Площадь: {data.area} м²\n"
        content += f"Стиль: {data.style}\n"
        content += f"Бюджет: {data.budget}\n"
        if data.comment:
            content += f"Комментарий: {data.comment}\n"
            
        msg = EmailMessage()
        msg['Subject'] = 'Ваши ответы на квиз Interio'
        msg['From'] = SMTP_USER
        msg['To'] = recipient_email
        msg.set_content(
            f"Здравствуйте, {data.name}!\n\n"
            "Спасибо за заполнение формы на разработку вашего дизайн-проекта. \n"
            "Во вложении вы найдете текстовый файл с вашими ответами.\n\n"
            "Мы ознакомимся с вашей заявкой и свяжемся с вами в ближайшее время для обсуждения деталей!\n\n"
            "С уважением,\nКоманда Interio"
        )
        msg.add_attachment(content.encode('utf-8'), maintype='text', subtype='plain', charset='utf-8', filename='interio_preferences.txt')
        
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        print(f"Письмо успешно отправлено на {recipient_email}")
    except Exception as e:
        print(f"Ошибка при отправке письма: {e}")

# GigaChat - clean DESIGN_WORDS
DESIGN_WORDS = [
    "дизайн", "интерьер", "ремонт", "стиль", "квартир", "комнат", "мебел", "отделк",
    "планировк", "освещен", "цвет", "бюджет", "кухн", "спальн", "гостин", "лофт",
    "минимализм", "скандинав", "классик", "диван", "стол", "шкаф", "декор",
    "interior", "design", "renovation", "furniture", "budget", "room"
]

def _is_design(text):
    t = text.lower()
    return any(w in t for w in DESIGN_WORDS)

async def gc_get_token():
    global GC_TOKEN, GC_EXP
    if GC_TOKEN and time.time() < GC_EXP:
        return GC_TOKEN
    if not GIGACHAT_KEY:
        return None
    try:
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            r = await c.post(
                "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
                headers={"Authorization": f"Basic {GIGACHAT_KEY.strip()}", "RqUID": str(uuid.uuid4())},
                data={"scope": "GIGACHAT_API_PERS"}
            )
            if r.status_code != 200:
                return None
            d = r.json()
            GC_TOKEN = d.get("access_token")
            exp = d.get("expires_at", 0)
            GC_EXP = (exp - 60) if exp > 1000000000 else (time.time() + 1740)
            return GC_TOKEN
    except:
        return None

async def gc_ask(question):
    if not _is_design(question):
        return "Я помогаю только с вопросами по дизайну интерьера, бюджету, планировке и стилям! Спросите что-нибудь по этим темам."
    tok = await gc_get_token()
    if not tok:
        return "ИИ временно недоступен. Попробуйте позже."
    try:
        async with httpx.AsyncClient(verify=False, timeout=30) as c:
            r = await c.post(
                "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
                json={
                    "model": "GigaChat",
                    "messages": [{"role": "user", "content": "Ты - опытный дизайнер интерьера. Ответь кратко (2-3 предложения) на русском: " + question}],
                    "max_tokens": 400,
                    "temperature": 0.7
                }
            )
            if r.status_code == 401:
                global GC_TOKEN, GC_EXP
                GC_TOKEN = None; GC_EXP = 0
                return "Токен устарел, попробуйте ещё раз"
            data = r.json()
            choices = data.get("choices", [])
            if not choices:
                return "ИИ не ответил"
            return choices[0]["message"]["content"].strip()
    except httpx.TimeoutException:
        return "Превышено время ожидания"
    except Exception as e:
        return "Ошибка ИИ: " + str(type(e).__name__)

# Notifications
async def notify_tg(text):
    if not TG_API or not TG_CHAT: return
    try:
        async with httpx.AsyncClient() as c:
            await c.post(f"{TG_API}/sendMessage", json={"chat_id": TG_CHAT, "text": text, "parse_mode": "HTML"}, timeout=10)
    except: pass

@app.on_event("startup")
async def startup(): init_db()

# Pages
@app.get("/", response_class=HTMLResponse)
async def page_index(): return FileResponse("templates/index.html")

@app.get("/quiz", response_class=HTMLResponse)
async def page_quiz(): return FileResponse("templates/quiz.html")

@app.get("/result/{sl}", response_class=HTMLResponse)
async def page_result(sl: str): return FileResponse("templates/result.html")

@app.get("/portfolio", response_class=HTMLResponse)
async def page_portfolio(): return FileResponse("templates/portfolio.html")

@app.get("/design/{did}", response_class=HTMLResponse)
async def page_design(did: int): return FileResponse("templates/design.html")

@app.get("/track", response_class=HTMLResponse)
async def page_track(): return FileResponse("templates/track.html")

@app.get("/admin", response_class=HTMLResponse)
async def page_admin(): return FileResponse("templates/admin.html")

@app.get("/cabinet", response_class=HTMLResponse)
async def page_cabinet(): return FileResponse("templates/cabinet.html")

@app.get("/privacy", response_class=HTMLResponse)
async def page_privacy(): return FileResponse("templates/privacy.html")

@app.get("/terms", response_class=HTMLResponse)
async def page_terms(): return FileResponse("templates/terms.html")

@app.get("/health")
async def health(): return {"status": "ok", "service": "interio"}

# Auth
@app.post("/api/auth/check-phone")
async def auth_check_phone(req: PhoneCheck):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT id FROM users WHERE phone = ?", (req.phone.strip(),))
    user = c.fetchone(); conn.close()
    return {"exists": user is not None, "phone": req.phone.strip()}

@app.post("/api/auth/login")
async def auth_login(req: LoginReq, resp: Response):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM users WHERE phone = ? AND password_hash = ?", (req.phone.strip(), hash_pw(req.password)))
    user = c.fetchone()
    if user:
        session_token = create_user_session(c, user["id"])
        conn.commit(); conn.close()
        set_session_cookie(resp, session_token)
        return {"success": True, "user": {"id": user["id"], "phone": user["phone"], "nickname": user["nickname"]}}
    conn.close()
    raise HTTPException(401, "Неверный пароль")

@app.post("/api/auth/register")
async def auth_register(req: RegisterReq, resp: Response):
    validated_password = validate_password(req.password)
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT id, phone, nickname FROM users WHERE phone = ? OR nickname = ?", (req.phone.strip(), req.nickname.strip()))
    existing = c.fetchone()
    if existing:
        conn.close()
        if existing["phone"] == req.phone.strip(): raise HTTPException(409, "Телефон занят")
        raise HTTPException(409, "Никнейм занят")
    c.execute("INSERT INTO users (phone, nickname, password_hash) VALUES (?, ?, ?)", (req.phone.strip(), req.nickname.strip(), hash_pw(validated_password)))
    uid = c.lastrowid
    session_token = create_user_session(c, uid)
    conn.commit(); conn.close()
    set_session_cookie(resp, session_token)
    return {"success": True, "user": {"id": uid, "phone": req.phone.strip(), "nickname": req.nickname.strip()}}

@app.post("/api/auth/logout")
async def auth_logout(request: Request, resp: Response):
    session_token = request.cookies.get("session_id")
    if session_token:
        conn = get_db(); c = conn.cursor()
        c.execute('DELETE FROM sessions WHERE session_token = ?', (session_token,))
        conn.commit(); conn.close()
    resp.delete_cookie(key="session_id", path="/")
    return {"success": True}

@app.get("/api/auth/current-user")
async def auth_current(request: Request):
    session_token = request.cookies.get("session_id")
    if not session_token:
        return {"success": False, "user": None}
    now = int(time.time())
    conn = get_db(); c = conn.cursor()
    c.execute(
        '''SELECT u.id, u.phone, u.nickname, u.role FROM sessions s 
           JOIN users u ON s.user_id = u.id 
           WHERE s.session_token = ? AND s.expires_at > ?''',
        (session_token, now),
    )
    row = c.fetchone(); conn.close()
    if row:
        return {"success": True, "user": {"id": row["id"], "phone": row["phone"], "nickname": row["nickname"], "role": row.get("role", "user")}}
    return {"success": False, "user": None}

@app.get("/api/auth/users")
async def auth_users():
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT id, phone, nickname, created_at FROM users ORDER BY created_at DESC")
    users = [dict(u) for u in c.fetchall()]; conn.close()
    return {"users": users}

@app.post("/api/auth/admin-login")
async def admin_login(req: AdminLogin, http_request: Request, resp: Response):
    if req.code != ADMIN_CODE:
        raise HTTPException(401, "Неверный код")
    session_token = http_request.cookies.get("session_id")
    if not session_token:
        raise HTTPException(401, "Требуется авторизация")
    now = int(time.time())
    conn = get_db(); c = conn.cursor()
    c.execute('SELECT user_id FROM sessions WHERE session_token = ? AND expires_at > ?', (session_token, now))
    session = c.fetchone()
    if not session:
        conn.close()
        raise HTTPException(401, "Сессия недействительна")
    c.execute('UPDATE users SET role = ? WHERE id = ?', ('admin', session["user_id"]))
    conn.commit(); conn.close()
    return {"success": True, "message": "Доступ к админ панели предоставлен"}

# Profile
@app.post("/api/profile/update")
async def profile_update(req: ProfileUpdate, resp: Response):
    conn = get_db(); c = conn.cursor()
    c.execute("UPDATE users SET nickname = ?, bio = ? WHERE phone = ?", (req.nickname, req.bio, req.phone))
    conn.commit(); conn.close()
    return {"success": True, "nickname": req.nickname, "bio": req.bio}

@app.post("/api/profile/avatar")
async def profile_avatar(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 5*1024*1024: raise HTTPException(400, "Max 5MB")
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    name = f"avatar_{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(UPLOAD_DIR, name), "wb") as f: f.write(content)
    return {"success": True, "url": f"/uploads/{name}"}

@app.get("/api/profile/submissions/{phone}")
async def profile_submissions(phone: str):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM quiz_submissions WHERE phone = ? ORDER BY created_at DESC", (phone,))
    subs = [dict(s) for s in c.fetchall()]; conn.close()
    return {"submissions": subs}

# Quiz
@app.post("/api/quiz/submit")
async def quiz_submit(req: QuizSubmit, request: Request, background_tasks: BackgroundTasks):
    if not req.name or not req.phone or not req.email:
        raise HTTPException(400, "Имя, телефон и email обязательны")
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, req.email):
        raise HTTPException(400, "Введите корректный email адрес")
    if not req.room_type or not req.style or not req.budget:
        raise HTTPException(400, "Заполните все шаги")
    if not req.consent:
        raise HTTPException(400, "Необходимо согласие")
    clean = re.sub(r'[^\d]', '', req.phone)
    if len(clean) != 11 or not clean.startswith(('7', '8')):
        raise HTTPException(400, "Некорректный телефон")
    phone = '+' + (clean if clean.startswith('7') else '7' + clean[1:])
    share_link = secrets.token_urlsafe(12)
    photos = json.dumps(req.photo_urls or [])
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT id FROM users WHERE phone = ?", (phone,)); u = c.fetchone(); uid = u["id"] if u else None
    c.execute('''INSERT INTO quiz_submissions (name, phone, email, room_type, zones, area, style, budget, comment, consent, share_link, user_id, photo_urls) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        (req.name, phone, req.email, req.room_type, ','.join(req.zones) if req.zones else '', req.area, req.style, req.budget, req.comment, req.consent, share_link, uid, photos))
    sid = c.lastrowid; conn.commit(); conn.close()
    txt = f"🆕 <b>Новая заявка!</b>\n\n👤 {req.name}\n📱 {phone}\n🎨 {req.style}\n💰 {req.budget}\n🏢 {req.room_type}\n💬 {req.comment or '—'}"
    asyncio.create_task(notify_tg(txt))
    if req.email:
        background_tasks.add_task(send_quiz_email, req.email, req)
    return {"success": True, "submission_id": sid, "share_link": share_link}

@app.get("/api/quiz/submissions")
async def quiz_all():
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM quiz_submissions ORDER BY created_at DESC LIMIT 100")
    subs = [dict(s) for s in c.fetchall()]; conn.close()
    return {"submissions": subs}

# GigaChat
@app.post("/api/support")
async def support(req: GigaChatReq):
    return {"answer": await gc_ask(req.question)}

# Upload
@app.post("/api/upload-photo")
async def upload_photo(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"): raise HTTPException(400, "Only images")
    content = await file.read()
    if len(content) > 5*1024*1024: raise HTTPException(400, "Max 5MB")
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    name = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(UPLOAD_DIR, name), "wb") as f: f.write(content)
    return {"success": True, "url": f"/uploads/{name}"}

# Portfolio
@app.get("/api/portfolio")
async def portfolio_list(style: str = None, sort: str = "newest"):
    conn = get_db(); c = conn.cursor()
    if style: c.execute("SELECT * FROM portfolio WHERE style = ? ORDER BY created_at DESC", (style,))
    else: c.execute("SELECT * FROM portfolio ORDER BY created_at DESC")
    designs = [dict(d) for d in c.fetchall()]; conn.close()
    return {"designs": designs}

@app.get("/api/portfolio/{did}")
async def portfolio_view(did: int):
    conn = get_db(); c = conn.cursor()
    c.execute("UPDATE portfolio SET views_count = views_count + 1 WHERE id = ?", (did,))
    c.execute("SELECT * FROM portfolio WHERE id = ?", (did,))
    d = c.fetchone(); conn.commit(); conn.close()
    if not d: raise HTTPException(404, "Not found")
    return dict(d)

@app.post("/api/portfolio/{did}/like")
async def portfolio_like(did: int, req: Request):
    ip = req.client.host; conn = get_db(); c = conn.cursor()
    c.execute("SELECT id FROM likes WHERE design_id = ? AND ip_address = ?", (did, ip)); existing = c.fetchone()
    if existing:
        c.execute("DELETE FROM likes WHERE id = ?", (existing["id"],))
        c.execute("UPDATE portfolio SET likes_count = MAX(0, likes_count - 1) WHERE id = ?", (did,)); liked = False
    else:
        c.execute("INSERT INTO likes (design_id, ip_address) VALUES (?, ?)", (did, ip))
        c.execute("UPDATE portfolio SET likes_count = likes_count + 1 WHERE id = ?", (did,)); liked = True
    c.execute("SELECT likes_count FROM portfolio WHERE id = ?", (did,))
    row = c.fetchone(); conn.commit(); conn.close()
    return {"liked": liked, "likes_count": row["likes_count"] if row else 0}

@app.post("/api/portfolio/{did}/comment")
async def portfolio_comment(did: int, req: CommentReq):
    if not req.text.strip(): raise HTTPException(400, "Empty")
    conn = get_db(); c = conn.cursor()
    c.execute("INSERT INTO comments (design_id, author_name, text) VALUES (?,?,?)", (did, req.author_name, req.text))
    conn.commit(); c.execute("SELECT * FROM comments WHERE id = ?", (c.lastrowid,)); cm = c.fetchone(); conn.close()
    return dict(cm)

@app.get("/api/portfolio/{did}/comments")
async def portfolio_comments(did: int):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM comments WHERE design_id = ? ORDER BY created_at DESC", (did,))
    cms = [dict(c) for c in c.fetchall()]; conn.close()
    return {"comments": cms}

@app.post("/api/portfolio/publish")
async def portfolio_publish(req: dict):
    pj = json.dumps(req.get("scene_params",{}), ensure_ascii=False)
    conn = get_db(); c = conn.cursor()
    c.execute('''INSERT INTO portfolio (title, description, scene_params, style, room, budget) VALUES (?,?,?,?,?,?)''',
        (req.get("title",""), req.get("description",""), pj, req.get("style",""), req.get("room",""), req.get("budget","")))
    pid = c.lastrowid; conn.commit(); conn.close()
    return {"success": True, "design_id": pid}

# Track
@app.post("/api/track/request-code")
async def track_request(req: PhoneCheck):
    import random; code = str(random.randint(1000, 9999))
    print(f"Code for {req.phone}: {code}")
    return {"success": True, "demo_code": code}

@app.post("/api/track/verify")
async def track_verify(req: TrackCode):
    conn = get_db(); c = conn.cursor()
    clean = re.sub(r'[^\d]', '', req.phone)
    norm = '+' + (clean if clean.startswith('7') else '7' + clean[1:])
    c.execute("SELECT * FROM quiz_submissions WHERE phone = ? ORDER BY created_at DESC", (norm,))
    subs = [dict(s) for s in c.fetchall()]; conn.close()
    return {"success": True, "submissions": subs}

# Admin endpoints
@app.get("/api/admin/submissions")
async def get_admin_submissions(request: Request):
    admin_user = get_current_admin_user(request)
    if not admin_user:
        raise HTTPException(403, "Доступ запрещен")
    conn = get_db(); c = conn.cursor()
    c.execute('''
        SELECT qs.*, u.nickname as user_nickname
        FROM quiz_submissions qs
        LEFT JOIN users u ON qs.user_id = u.id
        ORDER BY qs.created_at DESC
        LIMIT 100
    ''')
    subs = [dict(s) for s in c.fetchall()]; conn.close()
    return {"success": True, "submissions": subs}

@app.put("/api/admin/submissions/{submission_id}")
async def update_submission_status(submission_id: int, request: Request, status_request: dict):
    admin_user = get_current_admin_user(request)
    if not admin_user:
        raise HTTPException(403, "Доступ запрещен")
    new_status = status_request.get("status")
    if new_status not in ["new", "contacted", "in_progress", "completed", "cancelled"]:
        raise HTTPException(400, "Неверный статус")
    conn = get_db(); c = conn.cursor()
    c.execute('UPDATE quiz_submissions SET status = ? WHERE id = ?', (new_status, submission_id))
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(404, "Заявка не найдена")
    conn.commit(); conn.close()
    return {"success": True, "message": f"Статус заявки {submission_id} обновлен на {new_status}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=5000, reload=True)
