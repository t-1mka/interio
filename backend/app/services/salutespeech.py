import httpx
import base64
import uuid
from typing import Optional
from app.config import settings

SALUTE_TOKEN_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
SALUTE_RECOGNIZE_URL = "https://smartspeech.sber.ru/rest/v1/speech:recognize"


async def _get_salute_token() -> Optional[str]:
    if not settings.SALUTE_AUTH_KEY:
        return None

    credentials = base64.b64encode(settings.SALUTE_AUTH_KEY.encode()).decode()
    headers = {
        "Authorization": f"Basic {credentials}",
        "RqUID": str(uuid.uuid4()),
        "Content-Type": "application/x-www-form-urlencoded",
    }

    try:
        async with httpx.AsyncClient(verify=False, timeout=10) as client:
            resp = await client.post(
                SALUTE_TOKEN_URL,
                headers=headers,
                data={"scope": "SALUTE_SPEECH_PERS"},
            )
            resp.raise_for_status()
            return resp.json().get("access_token")
    except Exception as e:
        print(f"SaluteSpeech token error: {e}")
        return None


async def recognize_speech(audio_bytes: bytes, audio_format: str = "wav") -> str:
    """Recognize speech from audio bytes. Returns transcribed text."""
    token = await _get_salute_token()
    if not token:
        return ""

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": f"audio/{audio_format}",
    }

    params = {
        "language": "ru-RU",
        "hypotheses_count": 1,
        "enable_profanity_filter": False,
        "insight_models": [],
    }

    try:
        async with httpx.AsyncClient(verify=False, timeout=30) as client:
            resp = await client.post(
                SALUTE_RECOGNIZE_URL,
                headers=headers,
                params=params,
                content=audio_bytes,
            )
            resp.raise_for_status()
            result = resp.json()
            hypotheses = result.get("result", [{}])
            if hypotheses:
                return hypotheses[0].get("normalized_text", "")
    except Exception as e:
        print(f"SaluteSpeech recognize error: {e}")

    return ""
