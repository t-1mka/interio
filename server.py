"""
Interio Server - Full Version
"""
from fastapi import FastAPI, HTTPException, Request, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from typing import Optional
import sqlite3, hashlib, secrets, os, re, json, uuid, httpx, aiosmtplib, asyncio, time
from email.message import EmailMessage
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="Interio API")

# Статика
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Настройки
DB_PATH = os.getenv("DATABASE_URL", "data.db")
if DB_PATH.startswith("sqlite"):
    DB_PATH = DB_PATH.split("///")[-1]
    if DB_PATH.startswith("/"): DB_PATH = DB_PATH[1:]
if not DB_PATH.endswith(".db") and not DB_PATH.endswith(".sqlite"):
    DB_PATH = "data.db"

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

GIGACHAT_KEY = os.getenv("GIGACHAT_AUTH_KEY", "")
GC_TOKEN, GC_EXP = None, 0
TG_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TG_CHAT = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
TG_API = f"https://api.telegram.org/bot{TG_TOKEN}" if TG_TOKEN else ""
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.yandex.ru")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASSWORD", "")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")

# Модели
class PhoneCheck(BaseModel): phone: str
class LoginReq(BaseModel): phone: str; password: str
class RegisterReq(BaseModel): phone: str; nickname: str; password: str
class QuizSubmit(BaseModel):
    name: str; phone: str; email: Optional[str] = None; room_type: str
    zones: list; area: int; style: str; budget: str
    comment: Optional[str] = None; consent: bool; photo_urls: list = []
class GigaChatReq(BaseModel): question: str
class PortfolioPublish(BaseModel): title: str; description: str = ""; scene_params: dict; share_link: str = None
class CommentReq(BaseModel): design_id: int; text: str; author_name: str = "Аноним"
class TrackCode(BaseModel): phone: str; code: str

# База данных
def init_db():
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT UNIQUE NOT NULL, nickname TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    c.execute('''CREATE TABLE IF NOT EXISTS quiz_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, room_type TEXT NOT NULL, zones TEXT NOT NULL, area INTEGER NOT NULL, style TEXT NOT NULL, budget TEXT NOT NULL, comment TEXT, consent BOOLEAN NOT NULL, share_link TEXT UNIQUE, user_id INTEGER, photo_urls TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users (id))''')
    c.execute('''CREATE TABLE IF NOT EXISTS portfolio (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, scene_params TEXT, style TEXT, room TEXT, budget TEXT, likes_count INTEGER DEFAULT 0, views_count INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    c.execute('''CREATE TABLE IF NOT EXISTS likes (id INTEGER PRIMARY KEY AUTOINCREMENT, design_id INTEGER NOT NULL, ip_address TEXT, FOREIGN KEY (design_id) REFERENCES portfolio (id))''')
    c.execute('''CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, design_id INTEGER NOT NULL, author_name TEXT NOT NULL, text TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (design_id) REFERENCES portfolio (id))''')
    conn.commit(); conn.close()
    print("✅ База данных готова")

def get_db():
    conn = sqlite3.connect(DB_PATH); conn.row_factory = sqlite3.Row; return conn
def hash_pw(p): return hashlib.sha256(p.encode()).hexdigest()

# GigaChat
async def gc_get_token():
    global GC_TOKEN, GC_EXP
    if GC_TOKEN and time.time() < GC_EXP: return GC_TOKEN
    if not GIGACHAT_KEY: return None
    try:
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            r = await c.post("https://ngw.devices.sberbank.ru:9443/api/v2/oauth", headers={"Authorization": f"Basic {GIGACHAT_KEY.strip()}", "RqUID": str(uuid.uuid4())}, data={"scope": "GIGACHAT_API_PERS"})
            if r.status_code != 200: return None
            d = r.json(); GC_TOKEN = d.get("access_token"); exp = d.get("expires_at", 0); GC_EXP = (exp-60) if exp>1e9 else (time.time()+1740); return GC_TOKEN
    except: return None

DESIGN_WORDS = ["дизайн","интерьер","ремонт","стиль","квартир","комнат","мебел","отделк","планировк","освещен","цвет","бюджет","кухн","спальн","гостин","лофт","минимализм","скандинав","классик","диван","стол","шкаф","декор","interior","design"]
async def gc_ask(question):
    if not any(w in question.lower() for w in DESIGN_WORDS): return "🏠 Я помогаю только с вопросами по дизайну интерьера!"
    tok = await gc_get_token()
    if not tok: return "🤖 ИИ временно недоступен"
    try:
        async with httpx.AsyncClient(verify=False, timeout=20) as c:
            r = await c.post("https://gigachat.devices.sberbank.ru/api/v1/chat/completions", headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}, json={"model": "GigaChat", "messages": [{"role": "user", "content": f"Ты — опытный дизайнер интерьера. Ответь кратко (2-3 предложения) на русском: {question}"}], "max_tokens": 300, "temperature": 0.7})
            if r.status_code == 401: global GC_TOKEN, GC_EXP; GC_TOKEN = None; GC_EXP = 0; return "🔄 Токен устарел"
            data = r.json(); choices = data.get("choices", []); return choices[0]["message"]["content"].strip() if choices else "⚠️ ИИ не ответил"
    except: return "⚠️ Ошибка ИИ"

# Уведомления
async def notify_tg(text):
    if not TG_API or not TG_CHAT: return
    try:
        async with httpx.AsyncClient() as c:
            await c.post(f"{TG_API}/sendMessage", json={"chat_id": TG_CHAT, "text": text, "parse_mode": "HTML"}, timeout=10)
    except: pass

async def notify_email(data):
    if not all([SMTP_USER, SMTP_PASS, ADMIN_EMAIL]): return
    msg = EmailMessage(); msg["Subject"] = f"🏠 Заявка от {data.get('name', '')}"; msg["From"] = SMTP_USER; msg["To"] = ADMIN_EMAIL
    msg.add_alternative(f"<html><body><h2>Новая заявка</h2><p>Имя: {data.get('name')}</p><p>Телефон: {data.get('phone')}</p><p>Помещение: {data.get('room_type')}</p><p>Стиль: {data.get('style')}</p><p>Бюджет: {data.get('budget')}</p></body></html>", subtype="html")
    try:
        async with aiosmtplib.SMTP(hostname=SMTP_HOST, port=SMTP_PORT, use_tls=True) as smtp: await smtp.login(SMTP_USER, SMTP_PASS); await smtp.send_message(msg)
    except: pass

@app.on_event("startup")
async def startup(): init_db()

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

@app.get("/health")
async def health(): return {"status": "ok", "service": "interio"}

# API Endpoints (Auth, Quiz, Support, Upload, Portfolio, Track)
@app.post("/api/auth/check-phone")
async def auth_check_phone(req: PhoneCheck):
    conn = get_db(); c = conn.cursor(); c.execute("SELECT id FROM users WHERE phone = ?", (req.phone.strip(),)); user = c.fetchone(); conn.close()
    return {"exists": user is not None, "phone": req.phone.strip()}

@app.post("/api/auth/login")
async def auth_login(req: LoginReq, resp: Response):
    conn = get_db(); c = conn.cursor(); c.execute("SELECT * FROM users WHERE phone = ? AND password_hash = ?", (req.phone.strip(), hash_pw(req.password))); user = c.fetchone(); conn.close()
    if user:
        sid = secrets.token_hex(16); resp.set_cookie(key="session_id", value=sid, max_age=3600*24*7, httponly=True)
        return {"success": True, "user": {"id": user["id"], "phone": user["phone"], "nickname": user["nickname"]}}
    raise HTTPException(401, "Неверный пароль")

@app.post("/api/auth/register")
async def auth_register(req: RegisterReq, resp: Response):
    if len(req.password) < 8 or not any(c.isalpha() for c in req.password): raise HTTPException(400, "Пароль: мин. 8 символов + буква")
    conn = get_db(); c = conn.cursor(); c.execute("SELECT id FROM users WHERE phone = ? OR nickname = ?", (req.phone.strip(), req.nickname.strip())); existing = c.fetchone()
    if existing:
        conn.close()
        if existing["phone"] == req.phone.strip(): raise HTTPException(409, "Телефон занят")
        raise HTTPException(409, "Никнейм занят")
    c.execute("INSERT INTO users (phone, nickname, password_hash) VALUES (?, ?, ?)", (req.phone.strip(), req.nickname.strip(), hash_pw(req.password)))
    uid = c.lastrowid; conn.commit(); conn.close()
    sid = secrets.token_hex(16); resp.set_cookie(key="session_id", value=sid, max_age=3600*24*7, httponly=True)
    return {"success": True, "user": {"id": uid, "phone": req.phone.strip(), "nickname": req.nickname.strip()}}

@app.post("/api/auth/logout")
async def auth_logout(resp: Response): resp.delete_cookie(key="session_id"); return {"success": True}

@app.get("/api/auth/current-user")
async def auth_current(): return {"success": False, "user": None}

@app.get("/api/auth/users")
async def auth_users():
    conn = get_db(); c = conn.cursor(); c.execute("SELECT id, phone, nickname, created_at FROM users ORDER BY created_at DESC"); users = [dict(u) for u in c.fetchall()]; conn.close()
    return {"users": users}

@app.post("/api/quiz/submit")
async def quiz_submit(req: QuizSubmit):
    if not req.name or not req.phone: raise HTTPException(400, "Имя и телефон обязательны")
    if not req.room_type or not req.style or not req.budget: raise HTTPException(400, "Заполните все шаги")
    if not req.consent: raise HTTPException(400, "Необходимо согласие")
    clean = re.sub(r'[^\d]', '', req.phone)
    if len(clean) != 11 or not clean.startswith(('7', '8')): raise HTTPException(400, "Некорректный телефон")
    phone = '+' + (clean if clean.startswith('7') else '7' + clean[1:])
    share_link = secrets.token_urlsafe(12); photos = json.dumps(req.photo_urls or [])
    conn = get_db(); c = conn.cursor(); c.execute("SELECT id FROM users WHERE phone = ?", (phone,)); u = c.fetchone(); uid = u["id"] if u else None
    c.execute('''INSERT INTO quiz_submissions (name, phone, email, room_type, zones, area, style, budget, comment, consent, share_link, user_id, photo_urls) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        (req.name, phone, req.email, req.room_type, ','.join(req.zones) if req.zones else '', req.area, req.style, req.budget, req.comment, req.consent, share_link, uid, photos))
    sid = c.lastrowid; conn.commit(); conn.close()
    txt = f"🆕 Новая заявка!\n\n👤 {req.name}\n📱 {phone}\n🎨 {req.style}\n💰 {req.budget}\n🏢 {req.room_type}\n📐 {req.area} м²\n💬 {req.comment or '—'}"
    asyncio.create_task(notify_tg(txt))
    asyncio.create_task(notify_email({"name": req.name, "phone": phone, "email": req.email, "room_type": req.room_type, "style": req.style, "budget": req.budget, "area": req.area, "comment": req.comment}))
    return {"success": True, "submission_id": sid, "share_link": share_link}

@app.get("/api/quiz/submissions")
async def quiz_all():
    conn = get_db(); c = conn.cursor(); c.execute("SELECT * FROM quiz_submissions ORDER BY created_at DESC LIMIT 50"); subs = [dict(s) for s in c.fetchall()]; conn.close()
    return {"submissions": subs}

@app.post("/api/support")
async def support(req: GigaChatReq): return {"answer": await gc_ask(req.question)}

@app.post("/api/upload-photo")
async def upload_photo(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"): raise HTTPException(400, "Только изображения")
    content = await file.read()
    if len(content) > 5*1024*1024: raise HTTPException(400, "Макс. 5MB")
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"; name = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(UPLOAD_DIR, name), "wb") as f: f.write(content)
    return {"success": True, "url": f"/uploads/{name}"}

@app.get("/api/portfolio")
async def portfolio_list(style: str = None, sort: str = "newest"):
    conn = get_db(); c = conn.cursor()
    if style: c.execute("SELECT * FROM portfolio WHERE style = ? ORDER BY created_at DESC", (style,))
    else: c.execute("SELECT * FROM portfolio ORDER BY created_at DESC")
    designs = [dict(d) for d in c.fetchall()]; conn.close()
    return {"designs": designs}

@app.get("/api/portfolio/{did}")
async def portfolio_view(did: int):
    conn = get_db(); c = conn.cursor(); c.execute("UPDATE portfolio SET views_count = views_count + 1 WHERE id = ?", (did,)); c.execute("SELECT * FROM portfolio WHERE id = ?", (did,)); d = c.fetchone(); conn.commit(); conn.close()
    if not d: raise HTTPException(404, "Не найдено")
    return dict(d)

@app.post("/api/portfolio/{did}/like")
async def portfolio_like(did: int, req: Request):
    ip = req.client.host; conn = get_db(); c = conn.cursor(); c.execute("SELECT id FROM likes WHERE design_id = ? AND ip_address = ?", (did, ip)); existing = c.fetchone()
    if existing: c.execute("DELETE FROM likes WHERE id = ?", (existing["id"],)); c.execute("UPDATE portfolio SET likes_count = MAX(0, likes_count - 1) WHERE id = ?", (did,)); liked = False
    else: c.execute("INSERT INTO likes (design_id, ip_address) VALUES (?, ?)", (did, ip)); c.execute("UPDATE portfolio SET likes_count = likes_count + 1 WHERE id = ?", (did,)); liked = True
    c.execute("SELECT likes_count FROM portfolio WHERE id = ?", (did,)); row = c.fetchone(); conn.commit(); conn.close()
    return {"liked": liked, "likes_count": row["likes_count"] if row else 0}

@app.post("/api/portfolio/{did}/comment")
async def portfolio_comment(did: int, req: CommentReq):
    if not req.text.strip(): raise HTTPException(400, "Пусто")
    conn = get_db(); c = conn.cursor(); c.execute("INSERT INTO comments (design_id, author_name, text) VALUES (?,?,?)", (did, req.author_name, req.text)); conn.commit(); c.execute("SELECT * FROM comments WHERE id = ?", (c.lastrowid,)); cm = c.fetchone(); conn.close()
    return dict(cm)

@app.get("/api/portfolio/{did}/comments")
async def portfolio_comments(did: int):
    conn = get_db(); c = conn.cursor(); c.execute("SELECT * FROM comments WHERE design_id = ? ORDER BY created_at DESC", (did,)); cms = [dict(c) for c in c.fetchall()]; conn.close()
    return {"comments": cms}

@app.post("/api/portfolio/publish")
async def portfolio_publish(req: PortfolioPublish):
    pj = json.dumps(req.scene_params, ensure_ascii=False); conn = get_db(); c = conn.cursor()
    c.execute('''INSERT INTO portfolio (title, description, scene_params, style, room, budget) VALUES (?,?,?,?,?,?)''', (req.title, req.description, pj, req.scene_params.get("style",""), req.scene_params.get("room_type",""), req.scene_params.get("budget","")))
    pid = c.lastrowid; conn.commit(); conn.close()
    return {"success": True, "design_id": pid}

@app.post("/api/track/request-code")
async def track_request(req: PhoneCheck):
    import random; code = str(random.randint(1000, 9999)); print(f"📱 Код для {req.phone}: {code}")
    return {"success": True, "demo_code": code}

@app.post("/api/track/verify")
async def track_verify(req: TrackCode):
    conn = get_db(); c = conn.cursor(); clean = re.sub(r'[^\d]', '', req.phone); norm = '+' + (clean if clean.startswith('7') else '7' + clean[1:])
    c.execute("SELECT * FROM quiz_submissions WHERE phone = ? ORDER BY created_at DESC", (norm,)); subs = [dict(s) for s in c.fetchall()]; conn.close()
    return {"success": True, "submissions": subs}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=5000, reload=True)
