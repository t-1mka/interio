from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import logging

from app.config import settings
from app.db import engine, Base
from app.routers import auth, quiz, gallery, profile, interio, pages

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="СвойСтиль API",
    description="Адаптивный смарт-квиз для дизайна интерьера",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files (uploads)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Routers
app.include_router(auth.router, prefix="/api")
app.include_router(quiz.router, prefix="/api")
app.include_router(gallery.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(interio.router, prefix="/api")
app.include_router(pages.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "СвойСтиль API"}


@app.on_event("startup")
async def startup_event():
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables created")

    # Ensure upload dir exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    logger.info("✅ СвойСтиль API started")


@app.on_event("shutdown")
async def shutdown_event():
    from app.utils.redis_client import close_redis
    await close_redis()
    await engine.dispose()
