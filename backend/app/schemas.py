from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# ──────────────────── Auth ────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=2)
    phone: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    phone: Optional[str]
    avatar_url: Optional[str]
    telegram_username: Optional[str]
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    telegram_id: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ──────────────────── Quiz / Application ────────────────────

class QuizSubmit(BaseModel):
    room: str
    style: str
    budget_min: int
    budget_max: int
    deadline: str
    colors: List[str]
    wishes: Optional[str] = ""
    contact_name: str
    contact_phone: str
    contact_email: Optional[str] = ""
    estimated_cost: Optional[float] = None


class ApplicationOut(BaseModel):
    id: int
    share_link: str
    room: str
    style: str
    budget_min: int
    budget_max: int
    deadline: str
    colors: List[str]
    wishes: Optional[str]
    contact_name: str
    contact_phone: str
    contact_email: Optional[str]
    promo_code: Optional[str]
    qr_code_url: Optional[str]
    design_image_url: Optional[str]
    pdf_url: Optional[str]
    estimated_cost: Optional[float]
    ai_description: Optional[str]
    photos: Optional[List[str]]
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────── Design / Gallery ────────────────────

class DesignPublish(BaseModel):
    application_id: int
    title: str
    description: Optional[str] = ""


class DesignUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_published: Optional[bool] = None


class AuthorOut(BaseModel):
    id: int
    name: str
    avatar_url: Optional[str]

    class Config:
        from_attributes = True


class CommentOut(BaseModel):
    id: int
    text: str
    user: AuthorOut
    created_at: datetime

    class Config:
        from_attributes = True


class DesignOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    main_image_url: Optional[str]
    images: Optional[List[str]]
    style: Optional[str]
    room: Optional[str]
    budget_min: Optional[int]
    budget_max: Optional[int]
    colors: Optional[List[str]]
    is_published: bool
    views_count: int
    likes_count: int
    author: AuthorOut
    created_at: datetime
    is_liked: Optional[bool] = False
    is_favorited: Optional[bool] = False

    class Config:
        from_attributes = True


class DesignDetail(DesignOut):
    comments: List[CommentOut] = []


class CommentCreate(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


# ──────────────────── Leaderboard ────────────────────

class LeaderboardEntry(BaseModel):
    user: AuthorOut
    total_likes: int
    designs_count: int
    rank: int
