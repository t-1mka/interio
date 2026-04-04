"""
Клавиатуры для Telegram-бота «Интерио».
"""
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton


def main_menu_kb(frontend_url: str = "http://localhost:3002") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏠 Пройти квиз", callback_data="quiz_start")],
        [InlineKeyboardButton(text="🌐 Квиз в браузере", web_app=WebAppInfo(url=f"{frontend_url}/quiz"))],
        [InlineKeyboardButton(text="🤖 ИИ-поддержка", callback_data="support")],
        [InlineKeyboardButton(text="📋 Мои заявки", callback_data="my_requests")],
        [InlineKeyboardButton(text="ℹ️ О сервисе", callback_data="about")],
    ])


def quiz_rooms_kb() -> InlineKeyboardMarkup:
    rooms = ["Гостиная", "Спальня", "Кухня", "Ванная", "Детская", "Кабинет", "Прихожая"]
    buttons = [[InlineKeyboardButton(text=r, callback_data=f"quiz_room:{r}")] for r in rooms]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def quiz_styles_kb() -> InlineKeyboardMarkup:
    styles = [
        "Современный", "Минимализм", "Скандинавский",
        "Классический", "Лофт", "Японский", "Арт-деко",
    ]
    buttons = [[InlineKeyboardButton(text=s, callback_data=f"quiz_style:{s}")] for s in styles]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def quiz_deadlines_kb() -> InlineKeyboardMarkup:
    deadlines = ["1 месяц", "3 месяца", "6 месяцев", "Без срока"]
    buttons = [[InlineKeyboardButton(text=d, callback_data=f"quiz_deadline:{d}")] for d in deadlines]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def quiz_colors_kb() -> InlineKeyboardMarkup:
    colors = [
        ("⬜ Белый/Светлый", "Белый"),
        ("⬛ Тёмный/Графит", "Тёмный"),
        ("🟤 Деревянный", "Деревянный"),
        ("🔵 Синий/Голубой", "Синий"),
        ("🟢 Зелёный", "Зелёный"),
        ("🟡 Жёлтый/Золотой", "Жёлтый"),
        ("🩷 Розовый/Коралловый", "Розовый"),
        ("🎨 Разноцветный", "Разноцветный"),
    ]
    buttons = [[InlineKeyboardButton(text=label, callback_data=f"quiz_color:{value}")] for label, value in colors]
    buttons.append([InlineKeyboardButton(text="✅ Готово", callback_data="quiz_colors_done")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def support_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 В главное меню", callback_data="back_to_start")]
    ])


def back_to_start_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 В главное меню", callback_data="back_to_start")]
    ])


# Для WebApp кнопки
from aiogram.types import WebAppInfo  # noqa: E402, F401
