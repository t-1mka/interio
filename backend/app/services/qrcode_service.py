import qrcode
import os
from io import BytesIO
from app.config import settings


def generate_qr_code(share_link: str) -> str:
    """Generate QR code for share link and save to uploads dir."""
    url = f"{settings.FRONTEND_URL}/result/{share_link}"

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filename = f"qr_{share_link}.png"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    img.save(filepath)

    return f"{settings.BASE_URL}/uploads/{filename}"
