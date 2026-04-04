from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Float,
    ForeignKey, JSON, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    telegram_id = Column(String(100), nullable=True, unique=True)
    telegram_username = Column(String(100), nullable=True)
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    applications = relationship("Application", back_populates="user", lazy="select")
    designs = relationship("Design", back_populates="author", lazy="select")
    likes = relationship("Like", back_populates="user", lazy="select")
    comments = relationship("Comment", back_populates="user", lazy="select")
    favorites = relationship("Favorite", back_populates="user", lazy="select")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True)
    share_link = Column(String(100), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Quiz answers
    room = Column(String(100))
    style = Column(String(100))
    budget_min = Column(Integer)
    budget_max = Column(Integer)
    deadline = Column(String(100))
    colors = Column(JSON)  # list of colors
    wishes = Column(Text)

    # Contact info
    contact_name = Column(String(255))
    contact_phone = Column(String(50))
    contact_email = Column(String(255))

    # Generated content
    promo_code = Column(String(50))
    qr_code_url = Column(String(500))
    design_image_url = Column(String(500))
    pdf_url = Column(String(500))
    estimated_cost = Column(Float)
    ai_description = Column(Text)

    # Photo uploads
    photos = Column(JSON)  # list of file paths

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship("User", back_populates="applications")
    design = relationship("Design", back_populates="application", uselist=False)


class Design(Base):
    __tablename__ = "designs"

    id = Column(Integer, primary_key=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=True)

    title = Column(String(255), nullable=False)
    description = Column(Text)
    main_image_url = Column(String(500))
    images = Column(JSON)  # list of image urls
    style = Column(String(100), index=True)
    room = Column(String(100), index=True)
    budget_min = Column(Integer)
    budget_max = Column(Integer)
    colors = Column(JSON)

    is_published = Column(Boolean, default=True)
    views_count = Column(Integer, default=0)
    likes_count = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    author = relationship("User", back_populates="designs")
    application = relationship("Application", back_populates="design")
    likes = relationship("Like", back_populates="design", lazy="select")
    comments = relationship("Comment", back_populates="design", lazy="select")
    favorites = relationship("Favorite", back_populates="design", lazy="select")


class Like(Base):
    __tablename__ = "likes"
    __table_args__ = (UniqueConstraint("user_id", "design_id"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    design_id = Column(Integer, ForeignKey("designs.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="likes")
    design = relationship("Design", back_populates="likes")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    design_id = Column(Integer, ForeignKey("designs.id"), nullable=False)
    text = Column(Text, nullable=False)
    is_approved = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="comments")
    design = relationship("Design", back_populates="comments")


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "design_id"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    design_id = Column(Integer, ForeignKey("designs.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="favorites")
    design = relationship("Design", back_populates="favorites")
