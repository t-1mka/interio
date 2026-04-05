from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from typing import Optional, List
import sqlite3
import re
import secrets
import hashlib
import datetime
import time
import uvicorn
import os
import threading
import requests

app = FastAPI(title="Auth API", version="1.0.0")

# Подключение статических файлов
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS настройки
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://127.0.0.1:5000", "http://localhost:58528", "http://127.0.0.1:58528"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
    allow_origin_regex="https://cdnjs\\.cloudflare\\.com/.*",
    expose_headers=["*"]
)

# Путь к базе данных
DB_PATH = 'data.db'

def keep_alive():
    """Функция для поддержания активности приложения"""
    app_url = os.getenv("APP_URL", "https://project-design.onrender.com")
    while True:
        try:
            response = requests.get(f"{app_url}/", timeout=10)
            if response.status_code == 200:
                print(f"✅ Keep-alive ping successful: {app_url}")
            else:
                print(f"⚠️ Keep-alive ping warning: {response.status_code}")
        except Exception as e:
            print(f"❌ Keep-alive ping failed: {str(e)}")
        time.sleep(300)  # 5 минут

# Запуск keep-alive в фоновом потоке
threading.Thread(target=keep_alive, daemon=True).start()

# Pydantic модели
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

class AdminLoginRequest(BaseModel):
    code: str

class QuizSubmissionRequest(BaseModel):
    name: str
    phone: str
    email: str  # Убрал Optional, теперь обязателен
    room_type: str
    zones: list
    area: int
    style: str
    budget: str
    comment: str = None
    consent: bool

class UserResponse(BaseModel):
    id: int
    phone: str
    nickname: str
    created_at: str

def init_db():
    """Инициализация базы данных"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE NOT NULL,
            nickname TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Добавляем колонку role если её нет
    try:
        cursor.execute('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "user"')
    except sqlite3.OperationalError:
        pass  # Колонка уже существует
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_token TEXT UNIQUE NOT NULL,
            user_id INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS quiz_submissions (
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
            user_id INTEGER,
            status TEXT DEFAULT 'new',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Добавляем колонку status если её нет
    try:
        cursor.execute('ALTER TABLE quiz_submissions ADD COLUMN status TEXT DEFAULT "new"')
    except sqlite3.OperationalError:
        pass  # Колонка уже существует
    
    conn.commit()
    conn.close()
    print("База данных SQLite инициализирована")

def get_db_connection():
    """Получение соединения с базой данных"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Валидация пароля
def get_current_admin_user(request: Request):
    """Проверка админ прав"""
    session_token = request.cookies.get("session_id")
    if not session_token:
        return None
    
    now = int(time.time())
    conn = get_db_connection()
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
        return {
            "id": row["id"],
            "phone": row["phone"],
            "nickname": row["nickname"],
            "role": row["role"],
        }
    return None

def validate_password(password: str) -> str:
    """Валидация пароля"""
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Пароль должен содержать минимум 8 символов")
    
    if not any(c.isalpha() for c in password):
        raise HTTPException(status_code=400, detail="Пароль должен содержать минимум одну букву")
    
    return password

def hash_password(password):
    """Хеширование пароля"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_user_session(cursor, user_id: int) -> str:
    """Создаёт запись сессии и возвращает токен для cookie."""
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

@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске"""
    init_db()

@app.post("/api/auth/check-phone")
async def check_phone(request: PhoneCheckRequest):
    """Проверка существования пользователя по номеру телефона"""
    try:
        phone = request.phone.strip()
        
        if not phone:
            raise HTTPException(status_code=400, detail="Номер телефона обязателен")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM users WHERE phone = ?', (phone,))
        user = cursor.fetchone()
        conn.close()
        
        return {
            "exists": user is not None,
            "phone": phone
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/login")
async def login(request: LoginRequest, response: Response):
    """Вход пользователя"""
    try:
        phone = request.phone.strip()
        password = request.password
        
        if not phone or not password:
            raise HTTPException(status_code=400, detail="Телефон и пароль обязательны")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT * FROM users WHERE phone = ? AND password_hash = ?', 
            (phone, hash_password(password))
        )
        user = cursor.fetchone()
        
        if user:
            session_token = create_user_session(cursor, user["id"])
            conn.commit()
            conn.close()
            set_session_cookie(response, session_token)
            
            return {
                "success": True,
                "user": {
                    "id": user["id"],
                    "phone": user["phone"],
                    "nickname": user["nickname"]
                }
            }
        conn.close()
        raise HTTPException(status_code=401, detail="Неверный пароль")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/register")
async def register(request: RegisterRequest, response: Response):
    """Регистрация нового пользователя"""
    try:
        phone = request.phone.strip()
        nickname = request.nickname.strip()
        password = request.password
        
        # Валидация никнейма
        if not nickname:
            raise HTTPException(status_code=400, detail="Никнейм обязателен")
        
        # Валидация пароля
        validated_password = validate_password(password)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Проверка уникальности телефона и никнейма (нужны колонки phone/nickname для ответа об ошибке)
        cursor.execute(
            'SELECT id, phone, nickname FROM users WHERE phone = ? OR nickname = ?',
            (phone, nickname),
        )
        existing_user = cursor.fetchone()
        
        if existing_user:
            conn.close()
            if existing_user["phone"] == phone:
                raise HTTPException(status_code=409, detail="Этот номер телефона уже зарегистрирован")
            else:
                raise HTTPException(status_code=409, detail="Этот никнейм уже занят")
        
        # Создание пользователя
        cursor.execute(
            'INSERT INTO users (phone, nickname, password_hash) VALUES (?, ?, ?)',
            (phone, nickname, hash_password(validated_password))
        )
        
        user_id = cursor.lastrowid
        session_token = create_user_session(cursor, user_id)
        conn.commit()
        conn.close()
        set_session_cookie(response, session_token)
        
        return {
            "success": True,
            "user": {
                "id": user_id,
                "phone": phone,
                "nickname": nickname
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/admin-login")
async def admin_login(request: AdminLoginRequest, http_request: Request, response: Response):
    """Вход в админ панель по коду"""
    try:
        ADMIN_CODE = "ADMIN123"  # В реальном проекте вынести в env
        
        if request.code != ADMIN_CODE:
            raise HTTPException(status_code=401, detail="Неверный код")
        
        # Получаем текущего пользователя
        session_token = http_request.cookies.get("session_id")
        if not session_token:
            raise HTTPException(status_code=401, detail="Требуется авторизация")
        
        now = int(time.time())
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT user_id FROM sessions WHERE session_token = ? AND expires_at > ?',
            (session_token, now),
        )
        session = cursor.fetchone()
        
        if not session:
            conn.close()
            raise HTTPException(status_code=401, detail="Сессия недействительна")
        
        # Обновляем роль пользователя на admin
        cursor.execute('UPDATE users SET role = ? WHERE id = ?', ('admin', session["user_id"]))
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "message": "Доступ к админ панели предоставлен"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    """Выход пользователя"""
    session_token = request.cookies.get("session_id")
    if session_token:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM sessions WHERE session_token = ?', (session_token,))
        conn.commit()
        conn.close()
    response.delete_cookie(key="session_id", path="/")
    return {"success": True}

@app.get("/api/auth/current-user")
async def current_user(request: Request):
    """Получение текущего пользователя по cookie-сессии"""
    session_token = request.cookies.get("session_id")
    if not session_token:
        return {"success": False, "user": None}
    now = int(time.time())
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''SELECT u.id, u.phone, u.nickname FROM sessions s
           JOIN users u ON s.user_id = u.id
           WHERE s.session_token = ? AND s.expires_at > ?''',
        (session_token, now),
    )
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "success": True,
            "user": {
                "id": row["id"],
                "phone": row["phone"],
                "nickname": row["nickname"],
            },
        }
    return {"success": False, "user": None}

@app.get("/api/auth/users")
async def get_users():
    """Получение списка пользователей (для отладки)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, phone, nickname, created_at FROM users ORDER BY created_at DESC')
    users = cursor.fetchall()
    conn.close()
    
    return {
        "users": [dict(user) for user in users]
    }

@app.post("/api/session/data")
async def get_session_data(request: SessionRequest):
    """Получение данных сессии StateManager"""
    try:
        # В реальном приложении здесь была бы проверка в Redis/БД
        # Для примера просто возвращаем заглушку
        return {
            "success": True,
            "session_id": request.session_id,
            "data": None,
            "message": "Данные сессии получены"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/session/save")
async def save_session_data(request: SessionRequest, http_request: Request):
    """Сохранение данных сессии StateManager"""
    try:
        # В реальном приложении здесь было бы сохранение в Redis/БД
        # Для примера просто логируем
        print(f"Сохранение данных сессии: {request.session_id}")
        
        return {
            "success": True,
            "message": "Данные сессии сохранены"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/quiz/submit")
async def submit_quiz(request: QuizSubmissionRequest, http_request: Request):
    """Сохранение заявки квиза в базу данных"""
    try:
        # Валидация обязательных полей
        if not request.name or not request.phone or not request.email:
            raise HTTPException(status_code=400, detail="Имя, телефон и email обязательны")
        
        # Валидация формата email
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, request.email):
            raise HTTPException(status_code=400, detail="Введите корректный email адрес")

        missing = []
        if not request.room_type:
            missing.append("тип помещения")
        if not request.zones:
            missing.append("зоны помещения")
        if not request.style:
            missing.append("стиль")
        if not request.budget:
            missing.append("бюджет")

        if missing:
            if len(missing) == 1:
                detail_msg = f"Необходимо выбрать {missing[0]}"
            elif len(missing) == 2:
                detail_msg = f"Необходимо выбрать {missing[0]} и {missing[1]}"
            else:
                detail_msg = f"Необходимо выбрать {', '.join(missing[:-1])} и {missing[-1]}"
            raise HTTPException(status_code=400, detail=detail_msg)

        if not request.consent:
            raise HTTPException(status_code=400, detail="Необходимо согласие на обработку данных")
        
        # Проверка формата телефона
        phone_clean = re.sub(r'[^\d]', '', request.phone)
        if len(phone_clean) != 11 or not phone_clean.startswith(('7', '8')):
            raise HTTPException(status_code=400, detail="Некорректный формат телефона")
        
        # Нормализация телефона
        normalized_phone = '+' + (phone_clean if phone_clean.startswith('7') else '7' + phone_clean[1:])
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Проверяем, есть ли пользователь с таким телефоном
        cursor.execute('SELECT id FROM users WHERE phone = ?', (normalized_phone,))
        user_record = cursor.fetchone()
        user_id = user_record["id"] if user_record else None
        
        # Сохраняем заявку квиза
        cursor.execute('''
            INSERT INTO quiz_submissions 
            (name, phone, email, room_type, zones, area, style, budget, comment, consent, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            request.name,
            normalized_phone,
            request.email,
            request.room_type,
            ','.join(request.zones) if request.zones else '',
            request.area,
            request.style,
            request.budget,
            request.comment,
            request.consent,
            user_id
        ))
        
        submission_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        print(f"Заявка квиза #{submission_id} успешно сохранена")
        
        return {
            "success": True,
            "submission_id": submission_id,
            "message": "Заявка успешно сохранена"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка при сохранении заявки квиза: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении заявки: {str(e)}")

@app.get("/api/quiz/submissions")
async def get_quiz_submissions():
    """Получение списка заявок квиза (для отладки)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT qs.*, u.nickname as user_nickname 
            FROM quiz_submissions qs 
            LEFT JOIN users u ON qs.user_id = u.id 
            ORDER BY qs.created_at DESC 
            LIMIT 50
        ''')
        submissions = cursor.fetchall()
        conn.close()
        
        return {
            "submissions": [dict(sub) for sub in submissions]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/submissions")
async def get_admin_submissions(request: Request):
    """Получение списка заявок для админки"""
    try:
        admin_user = get_current_admin_user(request)
        if not admin_user:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT qs.*, u.nickname as user_nickname 
            FROM quiz_submissions qs 
            LEFT JOIN users u ON qs.user_id = u.id 
            ORDER BY qs.created_at DESC 
            LIMIT 100
        ''')
        submissions = cursor.fetchall()
        conn.close()
        
        return {
            "success": True,
            "submissions": [dict(sub) for sub in submissions]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/admin/submissions/{submission_id}")
async def update_submission_status(submission_id: int, request: Request, status_request: dict):
    """Обновление статуса заявки"""
    try:
        admin_user = get_current_admin_user(request)
        if not admin_user:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
        
        new_status = status_request.get("status")
        if new_status not in ["new", "contacted", "in_progress", "completed", "cancelled"]:
            raise HTTPException(status_code=400, detail="Неверный статус")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            'UPDATE quiz_submissions SET status = ? WHERE id = ?',
            (new_status, submission_id)
        )
        
        if cursor.rowcount == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="Заявка не найдена")
        
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "message": f"Статус заявки {submission_id} обновлен на {new_status}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/", response_class=HTMLResponse)
async def root():
    """Главная страница"""
    return FileResponse("templates/index.html")

@app.get("/admin", response_class=HTMLResponse)
async def admin():
    """Страница админ панели"""
    return FileResponse("templates/admin.html")

@app.get("/quiz", response_class=HTMLResponse)
async def quiz():
    """Страница квиза"""
    return FileResponse("templates/quiz.html")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=5000, reload=True)
