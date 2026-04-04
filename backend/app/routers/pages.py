from fastapi import APIRouter
from fastapi.responses import HTMLResponse, FileResponse
from pathlib import Path

router = APIRouter(tags=["pages"])

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


@router.get("/", response_class=HTMLResponse)
async def index():
    """Главная страница Interio"""
    return HTMLResponse(content=(TEMPLATES_DIR / "index.html").read_text(encoding="utf-8"))


@router.get("/quiz", response_class=HTMLResponse)
async def quiz_page():
    """Страница квиза"""
    return HTMLResponse(content=(TEMPLATES_DIR / "quiz.html").read_text(encoding="utf-8"))


@router.get("/static/{filepath:path}")
async def static_files(filepath: str):
    """Раздача статических файлов"""
    file_path = Path(__file__).parent.parent / "static" / filepath
    if file_path.exists():
        return FileResponse(file_path)
    return FileResponse(file_path, status_code=404)
