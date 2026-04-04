# Interio — Смарт-квиз для дизайн-проекта

Платформа для сбора заявок на дизайн интерьера. FastAPI + SQLite, чистый HTML/CSS/JS без фреймворков.

## Быстрый старт (локально)

```bash
# 1. Клонируйте репозиторий
git clone <url>
cd interio

# 2. Создайте виртуальное окружение
python -m venv venv
source venv/bin/activate      # Linux/Mac
venv\Scripts\activate.bat     # Windows

# 3. Установите зависимости
pip install -r requirements.txt

# 4. Настройте переменные окружения
cp .env.example .env
# Отредактируйте .env — вставьте ключи GigaChat, Telegram, SMTP

# 5. Запустите сервер
uvicorn server:app --reload --port 8000

# Откройте http://localhost:8000
```

## Деплой на Render.com

1. Создайте аккаунт на [render.com](https://render.com)
2. **New → Web Service → Connect GitHub repo**
3. Render автоматически найдёт `render.yaml`
4. Перейдите в **Environment** и добавьте секреты:
   - `GIGACHAT_AUTH_KEY` — ключ от GigaChat (как есть, base64)
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ADMIN_CHAT_ID`
   - `SMTP_USER`, `SMTP_PASSWORD`, `ADMIN_EMAIL`
5. Нажмите **Deploy**

> ⚠️ Render free tier использует ephemeral filesystem — SQLite база сбрасывается при рестарте.  
> Для постоянного хранения: подключите **Render PostgreSQL** и замените `DATABASE_URL`.

## Через Docker

```bash
docker build -t interio .
docker run -p 8000:8000 --env-file .env interio
```

## Переменные окружения

| Переменная | Описание | Обязательно |
|-----------|----------|------------|
| `GIGACHAT_AUTH_KEY` | Base64-ключ GigaChat API | Для ИИ-советника |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота | Для уведомлений |
| `TELEGRAM_ADMIN_CHAT_ID` | Chat ID менеджера | Для уведомлений |
| `SMTP_HOST` | SMTP-сервер | Для email |
| `SMTP_PORT` | Порт SMTP (465 для TLS) | Для email |
| `SMTP_USER` | Логин email | Для email |
| `SMTP_PASSWORD` | Пароль приложения | Для email |
| `ADMIN_EMAIL` | Email менеджера | Для email |
| `DATABASE_URL` | sqlite:///data.db или postgresql://... | Нет |
| `UPLOAD_DIR` | Папка для фото (default: uploads) | Нет |

## Структура проекта

```
interio/
├── server.py          # FastAPI бэкенд (все API эндпоинты)
├── requirements.txt
├── render.yaml        # Конфигурация Render.com
├── Dockerfile
├── templates/
│   ├── index.html     # Главная страница
│   ├── quiz.html      # Квиз (6 шагов)
│   ├── result.html    # Результат / share
│   └── track.html     # Отслеживание заявки
├── static/
│   ├── styles.css     # Основные стили + темы
│   ├── actions.js     # Тема / доступность / цвета
│   ├── quiz.js        # Логика квиза
│   ├── state-manager.js
│   ├── auth.js
│   └── images/        # Фото стилей интерьера
└── uploads/           # Загруженные фото (создаётся автоматически)
```

## Известные особенности

- **GigaChat**: ключ `GIGACHAT_AUTH_KEY` должен быть в формате base64 (`clientId:clientSecret`) — вставляйте как есть из консоли Sber, **не кодируйте повторно**.
- **Render free**: сервис засыпает через 15 мин неактивности, первый запрос после сна занимает ~30 сек.
