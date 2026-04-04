"""
Interio вЂ” РЎРјР°СЂС‚-РєРІРёР· РґР»СЏ РґРёР·Р°Р№РЅ-РїСЂРѕРµРєС‚Р°
FastAPI + SQLite + GigaChat AI + Telegram + Email + Admin + Mailing
"""
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Request, Response, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from typing import Optional, List
import sqlite3, hashlib, secrets, os, re, json, uuid, httpx, aiosmtplib, asyncio, time
from email.message import EmailMessage
from datetime import datetime

app = FastAPI(title="Interio API")

# РЎС‚Р°С‚РёРєР°
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# РќР°СЃС‚СЂРѕР№РєРё
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
GC_TOKEN, GC_EXP = None, 0

# Telegram
TG_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TG_CHAT = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
TG_API = f"https://api.telegram.org/bot{TG_TOKEN}" if TG_TOKEN else ""

# Email
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.yandex.ru")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASSWORD", "")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")

# в•ђв•ђв•ђв•ђв•ђв•ђв•ђ РњРѕРґРµР»Рё в•ђв•ђв•ђв•ђв•ђв•ђв•ђ
class PhoneCheck(BaseModel): phone: str
class LoginReq(BaseModel): phone: str; password: str
class RegisterReq(BaseModel): phone: str; nickname: str; password: str
class QuizSubmit(BaseModel):
    name: str; phone: str; email: Optional[str] = None; room_type: str
    zones: list; area: int; style: str; budget: str
    comment: Optional[str] = None; consent: bool; photo_urls: list = []
class GigaChatReq(BaseModel): question: str
class CommentReq(BaseModel): design_id: int; text: str; author_name: str = "РђРЅРѕРЅРёРј"
class TrackCode(BaseModel): phone: str; code: str
class ProfileUpdate(BaseModel): nickname: str; bio: str = ""; phone: str = ""
class MailingReq(BaseModel): subject: str; message: str
class AdminLogin(BaseModel): username: str; password: str

# в•ђв•ђв•ђв•ђв•ђв•ђв•ђ Р‘Р°Р·Р° РґР°РЅРЅС‹С… в•ђв•ђв•ђв•ђв•ђв•ђв•ђ
def init_db():
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT UNIQUE NOT NULL,
        nickname TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
        avatar_url TEXT DEFAULT '', bio TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    c.execute('''CREATE TABLE IF NOT EXISTS quiz_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL,
        email TEXT, room_type TEXT NOT NULL, zones TEXT NOT NULL, area INTEGER NOT NULL,
        style TEXT NOT NULL, budget TEXT NOT NULL, comment TEXT, consent BOOLEAN NOT NULL,
        share_link TEXT UNIQUE, user_id INTEGER, photo_urls TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id))''')
    c.execute('''CREATE TABLE IF NOT EXISTS portfolio (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT,
        scene_params TEXT, style TEXT, room TEXT, budget TEXT,
        likes_count INTEGER DEFAULT 0, views_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    c.execute('''CREATE TABLE IF NOT EXISTS likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, design_id INTEGER NOT NULL,
        ip_address TEXT, FOREIGN KEY (design_id) REFERENCES portfolio (id))''')
    c.execute('''CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT, design_id INTEGER NOT NULL,
        author_name TEXT NOT NULL, text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (design_id) REFERENCES portfolio (id))''')
    c.execute('''CREATE TABLE IF NOT EXISTS mailings (
        id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT NOT NULL, message TEXT NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, sent_count INTEGER DEFAULT 0)''')
    c.execute('''CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY, data TEXT, expires_at TIMESTAMP)''')
    c.execute('''CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL)''')
    conn.commit(); conn.close()
    # Create default admin if none
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM admin_users")
    if c.fetchone()[0] == 0:
        c.execute("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)",
            ("admin", hashlib.sha256("admin123".encode()).hexdigest()))
        conn.commit()
    conn.close()
    print("вњ… Р‘Р°Р·Р° РґР°РЅРЅС‹С… РіРѕС‚РѕРІР°")

def get_db():
    conn = sqlite3.connect(DB_PATH); conn.row_factory = sqlite3.Row; return conn
def hash_pw(p): return hashlib.sha256(p.encode()).hexdigest()

# в•ђв•ђв•ђв•ђв•ђв•ђв•ђ GigaChat в•ђв•ђв•ђв•ђв•ђв•ђв•ђ
async def gc_get_token():
    global GC_TOKEN, GC_EXP
    if GC_TOKEN and time.time() < GC_EXP: return GC_TOKEN
    if not GIGACHAT_KEY: return None
    try:
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            r = await c.post("https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
                headers={"Authorization": f"Basic {GIGACHAT_KEY.strip()}", "RqUID": str(uuid.uuid4())},
                data={"scope": "GIGACHAT_API_PERS"})
            if r.status_code != 200: return None
            d = r.json(); GC_TOKEN = d.get("access_token")
            exp = d.get("expires_at", 0)
            GC_EXP = (exp - 60) if exp > 1e9 else (time.time() + 1740)
            return GC_TOKEN
    except: return None

DESIGN_WORDS = ["РґРёР·Р°Р№РЅ","РёРЅС‚РµСЂСЊРµСЂ","СЂРµРјРѕРЅС‚","СЃС‚РёР»СЊ","РєРІР°СЂС‚РёСЂ","РєРѕРјРЅР°С‚","РјРµР±РµР»","РѕС‚РґРµР»Рє",
    "РїР»Р°РЅРёСЂРѕРІРє","РѕСЃРІРµС‰РµРЅ","С†РІРµС‚","Р±СЋРґР¶РµС‚","РєСѓС…РЅ","СЃРїР°Р»СЊРЅ","РіРѕСЃС‚РёРЅ","Р»РѕС„С‚",
    "РјРёРЅРёРјР°Р»РёР·Рј","СЃРєР°РЅРґРёРЅР°РІ","РєР»Р°СЃСЃРёРє","РґРёРІР°РЅ","СЃС‚РѕР»","С€РєР°С„","РґРµРєРѕСЂ","interior","design"]

async def gc_ask(question):
    if not any(w in question.lower() for w in DESIGN_WORDS):
        return "рџЏ  РЇ РїРѕРјРѕРіР°СЋ С‚РѕР»СЊРєРѕ СЃ РІРѕРїСЂРѕСЃР°РјРё РїРѕ РґРёР·Р°Р№РЅСѓ РёРЅС‚РµСЂСЊРµСЂР°, Р±СЋРґР¶РµС‚Сѓ, РїР»Р°РЅРёСЂРѕРІРєРµ Рё СЃС‚РёР»СЏРј!"
    tok = await gc_get_token()
    if not tok: return "рџ¤– РР РІСЂРµРјРµРЅРЅРѕ РЅРµРґРѕСЃС‚СѓРїРµРЅ"
    try:
        async with httpx.AsyncClient(verify=False, timeout=20) as c:
            r = await c.post("https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
                json={"model": "GigaChat",
                      "messages": [{"role": "user", "content": f"РўС‹ вЂ” РѕРїС‹С‚РЅС‹Р№ РґРёР·Р°Р№РЅРµСЂ РёРЅС‚РµСЂСЊРµСЂР°. РћС‚РІРµС‚СЊ РєСЂР°С‚РєРѕ (2-3 РїСЂРµРґР»РѕР¶РµРЅРёСЏ) РЅР° СЂСѓСЃСЃРєРѕРј: {question}"}],
                      "max_tokens": 300, "temperature": 0.7})
            if r.status_code == 401:
                global GC_TOKEN, GC_EXP; GC_TOKEN = None; GC_EXP = 0
                return "рџ”„ РўРѕРєРµРЅ СѓСЃС‚Р°СЂРµР», РїРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰С‘ СЂР°Р·"
            data = r.json(); choices = data.get("choices", [])
            return choices[0]["message"]["content"].strip() if choices else "вљ пёЏ РР РЅРµ РѕС‚РІРµС‚РёР»"
    except: return "вљ пёЏ РћС€РёР±РєР° РР"

# в•ђв•ђв•ђв•ђв•ђв•ђв•ђ РЈРІРµРґРѕРјР»РµРЅРёСЏ в•ђв•ђв•ђв•ђв•ђв•ђв•ђ
async def notify_tg(text):
    if not TG_API or not TG_CHAT: return
    try:
        async with httpx.AsyncClient() as c:
            await c.post(f"{TG_API}/sendMessage", json={"chat_id": TG_CHAT, "text": text, "parse_mode": "HTML"}, timeout=10)
    except: pass

async def notify_email(data):
    if not all([SMTP_USER, SMTP_PASS, ADMIN_EMAIL]): return
    msg = EmailMessage(); msg["Subject"] = f"рџЏ  Р—Р°СЏРІРєР° РѕС‚ {data.get('name', '')}"
    msg["From"] = SMTP_USER; msg["To"] = ADMIN_EMAIL
    msg.add_alternative(f"<html><body><h2>РќРѕРІР°СЏ Р·Р°СЏРІРєР° Interio</h2><p>РРјСЏ: {data.get('name')}</p><p>РўРµР»РµС„РѕРЅ: {data.get('phone')}</p><p>РџРѕРјРµС‰РµРЅРёРµ: {data.get('room_type')}</p><p>РЎС‚РёР»СЊ: {data.get('style')}</p><p>Р‘СЋРґР¶РµС‚: {data.get('budget')}</p></body></html>", subtype="html")
    try:
        async with aiosmtplib.SMTP(hostname=SMTP_HOST, port=SMTP_PORT, use_tls=True) as smtp:
            await smtp.login(SMTP_USER, SMTP_PASS); await smtp.send_message(msg)
    except: pass

@app.on_event("startup")
async def startup(): init_db()

# в•ђв•ђв•ђв•ђв•ђв•ђв•ђ РЎРўР РђРќРР¦Р« в•ђв•ђв•ђв•ђв•ђв•ђв•ђ
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

@app.get("/cabinet", response_class=HTMLResponse)`nasync def page_cabinet(): return FileResponse("templates/cabinet.html")`n`n@app.get("/privacy", response_class=HTMLResponse)
async def page_privacy(): return FileResponse("templates/privacy.html")

@app.get("/terms", response_class=HTMLResponse)
async def page_terms(): return FileResponse("templates/terms.html")

@app.get("/health")
async def health(): return {"status": "ok", "service": "interio"}

# в•ђв•ђв•ђв•ђв•ђв•ђв•ђ РђР’РўРћР РР—РђР¦РРЇ в•ђв•ђв•ђв•ђв•ђв•ђв•ђ
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
    user = c.fetchone(); conn.close()
    if user:
        sid = secrets.token_hex(16)
        resp.set_cookie(key="session_id", value=sid, max_age=3600*24*7, httponly=True)
        return {"success": True, "user": {"id": user["id"], "phone": user["phone"], "nickname": user["nickname"], "avatar_url": user.get("avatar_url",""), "bio": user.get("bio","")}}
    raise HTTPException(401, "РќРµРІРµСЂРЅС‹Р№ РїР°СЂРѕР»СЊ")

@app.post("/api/auth/register")
async def auth_register(req: RegisterReq, resp: Response):
    if len(req.password) < 8 or not any(c.isalpha() for c in req.password):
        raise HTTPException(400, "РџР°СЂРѕР»СЊ: РјРёРЅ. 8 СЃРёРјРІРѕР»РѕРІ + Р±СѓРєРІР°")
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT id FROM users WHERE phone = ? OR nickname = ?", (req.phone.strip(), req.nickname.strip()))
    existing = c.fetchone()
    if existing:
        conn.close()
        if existing["phone"] == req.phone.strip(): raise HTTPException(409, "РўРµР»РµС„РѕРЅ Р·Р°РЅСЏС‚")
        raise HTTPException(409, "РќРёРєРЅРµР№Рј Р·Р°РЅСЏС‚")
    c.execute("INSERT INTO users (phone, nickname, password_hash) VALUES (?, ?, ?)", (req.phone.strip(), req.nickname.strip(), hash_pw(req.password)))
    uid = c.lastrowid; conn.commit(); conn.close()
    sid = secrets.token_hex(16)
    resp.set_cookie(key="session_id", value=sid, max_age=3600*24*7, httponly=True)
    return {"success": True, "user": {"id": uid, "phone": req.phone.strip(), "nickname": req.nickname.strip(), "avatar_url": "", "bio": ""}}

@app.post("/api/auth/logout")
async def auth_logout(resp: Response): resp.delete_cookie(key="session_id"); return {"success": True}

@app.get("/api/auth/current-user")
async def auth_current(): return {"success": False, "user": None}

@app.get("/api/auth/users")
async def auth_users():
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT id, phone, nickname, avatar_url, bio, created_at FROM users ORDER BY created_at DESC")
    users = [dict(u) for u in c.fetchall()]; conn.close()
    return {"users": users}

# в•ђв•ђв•ђв•ђв•ђв•ђв•ђ РџР РћР¤РР›Р¬ в•ђв•ђв•ђв•ђв•ђв•ђв•ђ
@app.post("/api/profile/update")
async def profile_update(req: ProfileUpdate, resp: Response):
    conn = get_db(); c = conn.cursor()
    c.execute("UPDATE users SET nickname = ?, bio = ? WHERE phone = ?", (req.nickname, req.bio, req.phone))
    conn.commit(); conn.close()
    return {"success": True, "nickname": req.nickname, "bio": req.bio}

@app.post("/api/profile/avatar")
async def profile_avatar(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 5*1024*1024: raise HTTPException(400, "РњР°РєСЃ. 5MB")
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

# в•ђв•ђв•ђв•ђв•ђв•ђв•ђ РљР’РР— в•ђв•ђв•ђв•ђв•ђв•ђв•ђ
@app.post("/api/quiz/submit")
async def quiz_submit(req: QuizSubmit):
    if not req.name or not req.phone: raise HTTPException(400, "РРјСЏ Рё С‚РµР»РµС„РѕРЅ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹")
    if not req.room_type or not req.style or not req.budget: raise HTTPException(400, "Р—Р°РїРѕР»РЅРёС‚Рµ РІСЃРµ С€Р°РіРё")
    if not req.consent: raise HTTPException(400, "РќРµРѕР±С…РѕРґРёРјРѕ СЃРѕРіР»Р°СЃРёРµ")
    clean = re.sub(r'[^\d]', '', req.phone)
    if len(clean) != 11 or not clean.startswith(('7', '8')): raise HTTPException(400, "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ С‚РµР»РµС„РѕРЅ")
    phone = '+' + (clean if clean.startswith('7') else '7' + clean[1:])
    share_link = secrets.token_urlsafe(12); photos = json.dumps(req.photo_urls or [])
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT id FROM users WHERE phone = ?", (phone,)); u = c.fetchone(); uid = u["id"] if u else None
    c.execute('''INSERT INTO quiz_submissions (name, phone, email, room_type, zones, area, style, budget, comment, consent, share_link, user_id, photo_urls) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        (req.name, phone, req.email, req.room_type, ','.join(req.zones) if req.zones else '', req.area, req.style, req.budget, req.comment, req.consent, share_link, uid, photos))
    sid = c.lastrowid; conn.commit(); conn.close()
    txt = f"рџ†• <b>РќРѕРІР°СЏ Р·Р°СЏРІРєР°!</b>\n\nрџ‘¤ {req.name}\nрџ“± {phone}\nрџЋЁ {req.style}\nрџ’° {req.budget}\nрџЏў {req.room_type}\nрџ“ђ {req.area} РјВІ"
    asyncio.create_task(notify_tg(txt))
    asyncio.create_task(notify_email({"name": req.name, "phone": phone, "email": req.email, "room_type": req.room_type, "style": req.style, "budget": req.budget, "area": req.area, "comment": req.comment}))
    return {"success": True, "submission_id": sid, "share_link": share_link}

@app.get("/api/quiz/submissions")
async def quiz_all():
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM quiz_submissions ORDER BY created_at DESC LIMIT 100")
    subs = [dict(s) for s in c.fetchall()]; conn.close()
    return {"submissions": subs}

# в•ђв•ђв•ђв•ђв•ђв•ђв•ђ GIGACHAT в•ђв•ђв•ђв•ђв•ђв•ђв•ђ
@app.post("/api/support")
async def support(req: GigaChatReq):
    return {"answer": await gc_ask(req.question)}

# в•ђв•ђв•ђв•ђв•ђв•ђв•ђ Р¤РћРўРћ в•ђв•ђв•ђв•ђв•ђв•ђв•ђ
@app.post("/api/upload-photo")
async def upload_photo(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"): raise HTTPException(400, "РўРѕР»СЊРєРѕ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ")
    content = await file.read()
    if len(content) > 5*1024*1024: raise HTTPException(400, "РњР°РєСЃ. 5MB")
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    name = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(UPLOAD_DIR, name), "wb") as f: f.write(content)
    return {"success": True, "url": f"/uploads/{name}"}

# в•ђв•ђв•ђв•ђв•ђв•ђв•ђ РџРћР РўР¤РћР›РРћ в•ђв•ђв•ђв•ђв•ђв•ђв•ђ
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
    if not d: raise HTTPException(404, "РќРµ РЅР°Р№РґРµРЅРѕ")
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
    if not req.text.strip(): raise HTTPException(400, "РџСѓСЃС‚Рѕ")
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

# в•ђв•ђв•ђв•ђв•ђв•ђв•ђ РўР Р•РљРРќР“ в•ђв•ђв•ђв•ђв•ђв•ђв•ђ
@app.post("/api/track/request-code")
async def track_request(req: PhoneCheck):
    import random; code = str(random.randint(1000, 9999))
    print(f"рџ“± РљРѕРґ РґР»СЏ {req.phone}: {code}")
    return {"success": True, "demo_code": code}

@app.post("/api/track/verify")
async def track_verify(req: TrackCode):
    conn = get_db(); c = conn.cursor()
    clean = re.sub(r'[^\d]', '', req.phone)
    norm = '+' + (clean if clean.startswith('7') else '7' + clean[1:])
    c.execute("SELECT * FROM quiz_submissions WHERE phone = ? ORDER BY created_at DESC", (norm,))
    subs = [dict(s) for s in c.fetchall()]; conn.close()
    return {"success": True, "submissions": subs}

# в•ђв•ђв•ђв•ђв•ђв•ђв•ђ Р РђРЎРЎР«Р›РљР в•ђв•ђв•ђв•ђв•ђв•ђв•ђ
@app.post("/api/admin/mailing")
async def admin_mailing(req: MailingReq):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT phone FROM users")
    phones = [r["phone"] for r in c.fetchall()]
    c.execute("INSERT INTO mailings (subject, message, sent_count) VALUES (?,?,?)", (req.subject, req.message, len(phones)))
    mid = c.lastrowid; conn.commit(); conn.close()
    # РћС‚РїСЂР°РІРєР° С‡РµСЂРµР· TG
    if TG_API and TG_CHAT:
        try:
            async with httpx.AsyncClient() as c:
                await c.post(f"{TG_API}/sendMessage", json={"chat_id": TG_CHAT, "text": f"рџ“ў <b>Р Р°СЃСЃС‹Р»РєР°: {req.subject}</b>\n\n{req.message}", "parse_mode": "HTML"}, timeout=10)
        except: pass
    return {"success": True, "mailing_id": mid, "sent_count": len(phones)}

@app.get("/api/admin/mailings")
async def admin_mailings():
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM mailings ORDER BY sent_at DESC LIMIT 50")
    ms = [dict(m) for m in c.fetchall()]; conn.close()
    return {"mailings": ms}

# в•ђв•ђв•ђв•ђв•ђв•ђв•ђ РђР”РњРРќ в•ђв•ђв•ђв•ђв•ђв•ђв•ђ
@app.post("/api/auth/admin-login")
async def admin_login(req: AdminLogin, resp: Response):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM admin_users WHERE username = ? AND password_hash = ?", (req.username, hash_pw(req.password)))
    user = c.fetchone(); conn.close()
    if user:
        sid = secrets.token_hex(16)
        resp.set_cookie(key="admin_session", value=sid, max_age=3600*24, httponly=True)
        return {"success": True}
    raise HTTPException(401, "РќРµРІРµСЂРЅС‹Рµ РґР°РЅРЅС‹Рµ")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=5000, reload=True)
