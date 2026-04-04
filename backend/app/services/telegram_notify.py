import httpx
from app.config import settings


async def _send_message(chat_id: str, text: str):
    if not settings.TELEGRAM_BOT_TOKEN or not chat_id:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            )
    except Exception as e:
        print(f"Telegram send error: {e}")


async def notify_admin_new_application(application):
    if not settings.TELEGRAM_ADMIN_CHAT_ID:
        return
    text = (
        f"🏠 <b>Новая заявка!</b>\n"
        f"👤 {application.contact_name} | {application.contact_phone}\n"
        f"🛋 {application.room} | {application.style}\n"
        f"💰 {application.budget_min}–{application.budget_max} тыс. руб.\n"
        f"📎 {settings.FRONTEND_URL}/result/{application.share_link}"
    )
    await _send_message(settings.TELEGRAM_ADMIN_CHAT_ID, text)


async def notify_like(author, liker, design):
    if not author or not author.telegram_id:
        return
    text = (
        f"❤️ <b>{liker.name}</b> оценил ваш дизайн «{design.title}»!\n"
        f"📎 {settings.FRONTEND_URL}/design/{design.id}"
    )
    await _send_message(author.telegram_id, text)


async def notify_comment(author, commenter, design, comment_text: str):
    if not author or not author.telegram_id:
        return
    text = (
        f"💬 <b>{commenter.name}</b> прокомментировал ваш дизайн «{design.title}»:\n"
        f"«{comment_text[:100]}»\n"
        f"📎 {settings.FRONTEND_URL}/design/{design.id}"
    )
    await _send_message(author.telegram_id, text)
