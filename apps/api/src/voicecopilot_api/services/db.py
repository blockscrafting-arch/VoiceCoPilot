"""Database session and initialization helpers."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from ..config import settings


class Base(DeclarativeBase):
    """Declarative base for ORM models."""


engine = create_engine(settings.database_url, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    """Create database tables if missing."""
    from .models import ProjectRecord, TranscriptRecord  # noqa: F401

    Base.metadata.create_all(engine)
