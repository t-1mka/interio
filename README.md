# 🏠 СвойСтиль — Смарт-квиз дизайна интерьера

Адаптивный веб-проект с ИИ-помощником, генерацией дизайнов и галереей работ.

## 🚀 Быстрый старт (локально)

```bash
# 1. Скопируйте .env
cp .env.example .env

# 2. Заполните TELEGRAM_BOT_TOKEN в .env

# 3. Запуск
docker-compose up --build
```

- **Фронтенд:** http://localhost:3002
- **API:** http://localhost:8001
- **Docs:** http://localhost:8001/api/docs

## 🧱 Стек

| Компонент | Технология |
|-----------|------------|
| Бэкенд | FastAPI + PostgreSQL + Redis |
| Фронтенд | React 18 + TypeScript + Tailwind + Framer Motion |
| ИИ | GigaChat (советы, описания, модерация) |
| Генерация | Kandinsky API (FusionBrain) |
| Голос | SaluteSpeech API |
| Бот | Telegram + aiogram 3.x |
| PDF | ReportLab |
| QR | qrcode |

## 📁 Структура

```
svoy-style/
├── backend/          # FastAPI + SQLAlchemy
├── frontend/         # React + TypeScript + Tailwind
├── bot/              # Telegram bot (aiogram 3.x)
├── docker-compose.yml
├── render.yaml       # Конфиг для Render.com
├── .env.example
└── .gitignore
```

## 🌐 Деплой

### Render.com (бэкенд + бот)

1. Запушьте код на GitHub
2. Перейдите на [render.com](https://render.com) → New Blueprint
3. Подключите репозиторий — `render.yaml` автоматически настроит:
   - **Бэкенд** (FastAPI) + PostgreSQL + Redis
   - **Бот** (aiogram)
4. Заполните переменные в Dashboard:
   - `TELEGRAM_BOT_TOKEN` — токен от @BotFather
   - `TELEGRAM_ADMIN_CHAT_ID` — ваш Telegram ID
5. Нажмите Deploy

### Netlify (фронтенд)

1. Войдите на [netlify.com](https://netlify.com)
2. New Site from Git → выберите репозиторий
3. Настройки:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `frontend/dist`
4. После деплоя откройте `netlify.toml` и замените `YOUR_BACKEND_URL` на URL бэкенда с Render
5. Передеплойте

### Telegram-бот

Бот деплоится автоматически через `render.yaml`. Если разворачиваете вручную:

```bash
cd bot
pip install -r requirements.txt
TELEGRAM_BOT_TOKEN=your_token API_URL=https://your-backend.onrender.com python main.py
```

## 📡 API endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| POST | /api/auth/register | Регистрация |
| POST | /api/auth/login | Вход |
| GET | /api/auth/me | Текущий пользователь |
| GET | /api/quiz/tip | ИИ-совет |
| POST | /api/quiz/submit | Отправить квиз |
| GET | /api/quiz/result/{link} | Результат |
| GET | /api/gallery/ | Список дизайнов |
| POST | /api/gallery/publish | Опубликовать |
| POST | /api/gallery/{id}/like | Лайк |
| GET | /api/gallery/leaderboard | Рейтинг |
| GET | /api/profile/me | Мой профиль |
| GET | /api/profile/applications | Мои заявки |

## 🤖 Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Главное меню |
| `/quiz` | Начать квиз |
| `/my_requests` | Мои заявки |
| `/about` | О проекте |

---
© 2024 СвойСтиль | Хакатон-проект
