import httpx
import base64
import asyncio
import os
from typing import Optional
from app.config import settings

KANDINSKY_URL = "https://api-key.fusionbrain.ai/key/api/v1"

# Demo/mock images for fallback (placeholder from picsum)
MOCK_IMAGES = [
    "https://picsum.photos/seed/interior1/800/600",
    "https://picsum.photos/seed/interior2/800/600",
    "https://picsum.photos/seed/interior3/800/600",
    "https://picsum.photos/seed/interior4/800/600",
]


def _get_headers():
    return {
        "X-Key": f"Key {settings.KANDINSKY_API_KEY}",
        "X-Secret": f"Secret {settings.KANDINSKY_SECRET_KEY}",
    }


async def _get_model_id() -> Optional[str]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{KANDINSKY_URL}/models", headers=_get_headers())
            resp.raise_for_status()
            models = resp.json()
            return str(models[0]["id"])
    except Exception as e:
        print(f"Kandinsky get model error: {e}")
        return None


async def generate_design_image(prompt: str, style: str = "INTERIOR") -> str:
    """
    Generate a design image using Kandinsky API.
    Falls back to a placeholder image if API is not configured.
    """
    if not settings.KANDINSKY_API_KEY:
        # Return a stable mock URL based on style
        style_map = {
            "Современный": "seed/modern-interior",
            "Минимализм": "seed/minimalist-interior",
            "Скандинавский": "seed/scandinavian-interior",
            "Классический": "seed/classic-interior",
            "Лофт": "seed/loft-interior",
            "Японский": "seed/japanese-interior",
        }
        seed = style_map.get(style, "seed/interior-design")
        return f"https://picsum.photos/{seed}/800/600"

    model_id = await _get_model_id()
    if not model_id:
        return f"https://picsum.photos/seed/interior-fallback/800/600"

    full_prompt = f"Interior design, {style} style, {prompt}, professional photography, 4k quality"

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            # Submit generation request
            resp = await client.post(
                f"{KANDINSKY_URL}/text2image/run",
                headers=_get_headers(),
                data={
                    "model_id": model_id,
                    "params": '{"type": "GENERATE", "numImages": 1, "width": 768, "height": 512, "generateParams": {"query": "' + full_prompt.replace('"', '') + '"}}'
                }
            )
            resp.raise_for_status()
            uuid_val = resp.json().get("uuid")

            if not uuid_val:
                return f"https://picsum.photos/seed/interior-fallback/800/600"

            # Poll for result (up to 60 seconds)
            for _ in range(12):
                await asyncio.sleep(5)
                check_resp = await client.get(
                    f"{KANDINSKY_URL}/text2image/status/{uuid_val}",
                    headers=_get_headers()
                )
                result = check_resp.json()
                if result.get("status") == "DONE":
                    images = result.get("images", [])
                    if images:
                        # Save base64 image to uploads dir
                        img_data = base64.b64decode(images[0])
                        filename = f"kandinsky_{uuid_val}.jpg"
                        filepath = os.path.join(settings.UPLOAD_DIR, filename)
                        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
                        with open(filepath, "wb") as f:
                            f.write(img_data)
                        return f"{settings.BASE_URL}/uploads/{filename}"
                    break
    except Exception as e:
        print(f"Kandinsky generation error: {e}")

    return f"https://picsum.photos/seed/interior-{hash(prompt) % 100}/800/600"
