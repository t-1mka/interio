# ═══════════════════════════════════════════
# ДЕПЛОЙ INTERIO НА RENDER
# ═══════════════════════════════════════════

## Шаг 1: Подготовь репозиторий
# Убедись что весь код в https://github.com/Pavel1778/flutter-cloud-ide
# Файлы должны быть в корне репозитория:
#   server.py
#   requirements.txt
#   render.yaml
#   .env
#   templates/*.html
#   static/*.js, static/*.css
#   uploads/ (папка)

## Шаг 2: Зарегистрируйся на Render
# https://render.com → Sign Up → GitHub

## Шаг 3: Создай Web Service
# 1. Dashboard → New + → Web Service
# 2. Connect к репозиторию Pavel1778/flutter-cloud-ide
# 3. Settings:
#    Name: interio
#    Branch: main
#    Root Directory: (оставь пустым)
#    Environment: Python 3
#    Build Command: pip install --no-cache-dir -r requirements.txt
#    Start Command: uvicorn server:app --host 0.0.0.0 --port $PORT
#    Instance Type: Free

## Шаг 4: Добавь переменные окружения
# В Render Dashboard → твой сервис → Environment:

# GIGACHAT_AUTH_KEY = MDE5ZDUzMWMtYjM2OS03NGIyLWE2ODgtNzAxMzhhMmE5NzUxOjNhM2IzM2I3LWQwNTItNDBlYS1iMTY1LWYzNDI1ZWEyZTk2ZQ==
# TELEGRAM_BOT_TOKEN = 8781630278:AAH4LqIzaQBRY7tOsOZkwbujwMF8r9ySuuQ
# TELEGRAM_ADMIN_CHAT_ID = (твой chat_id из Telegram)
# SMTP_HOST = smtp.yandex.ru
# SMTP_PORT = 465
# SMTP_USER = твой_email@yandex.ru
# SMTP_PASSWORD = пароль_приложения
# ADMIN_EMAIL = manager@interio.ru

## Шаг 5: Деплой
# Нажми Deploy → жди 2-3 минуты
# После деплоя: https://interio.onrender.com

## Шаг 6: Проверь
# Открой https://твое-имя.onrender.com/
# Открой https://твое-имя.onrender.com/quiz
# Открой https://твое-имя.onrender.com/docs (Swagger API)
# Нажми кнопку 🤖 — должен ответить GigaChat

## ═══════════════════════════════════════════
# ЧАСТЫЕ ПРОБЛЕМЫ:
## ═══════════════════════════════════════════

# 1. "Application startup failed"
#    → Проверь логи в Render Dashboard → Logs
#    → Убедись что server.py в корне репозитория

# 2. GigaChat не работает
#    → Проверь что GIGACHAT_AUTH_KEY правильный
#    → В логах должно быть без ошибок токена

# 3. 503 ошибка
#    → Free план засыпает через 15 мин бездействия
#    → Первый запрос после сна медленный (~50 сек)
#    → Нажми обновить страницу

# 4. База данных сбрасывается
#    → На Free плане SQLite в ephemeral disk
#    → Данные теряются при рестарте
#    → Для постоянного хранения подключи PostgreSQL

# ═══════════════════════════════════════════
# ЧЕКЛИСТ ПЕРЕД ДЕПЛОЕМ:
## ═══════════════════════════════════════════
# [x] server.py работает локально
# [x] requirements.txt содержит все зависимости
# [x] render.yaml в корне репозитория
# [x] .env НЕ закоммичен в git (есть в .gitignore)
# [x] Все HTML шаблоны в templates/
# [x] Все JS/CSS файлы в static/
# [x] uploads/ папка существует
# [x] GigaChat ключ работает (протестируй локально)
