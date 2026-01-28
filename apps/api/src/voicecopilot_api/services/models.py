"""Database ORM models."""

from sqlalchemy import Column, JSON, String, Text

from .db import Base


class ProjectRecord(Base):
    """Project record stored in the database."""

    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    context_text = Column(Text, default="", nullable=False)
    llm_model = Column(String, nullable=False)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    token = Column(String, nullable=False, index=True)
    files = Column(JSON, nullable=False, default=list)


class TranscriptRecord(Base):
    """Transcript metadata stored in the database."""

    __tablename__ = "transcripts"

    id = Column(String, primary_key=True)
    project_id = Column(String, nullable=False, index=True)
    storage_key = Column(String, nullable=False)
    created_at = Column(String, nullable=False)
