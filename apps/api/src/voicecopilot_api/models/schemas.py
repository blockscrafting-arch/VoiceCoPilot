"""Pydantic schemas for API request/response models."""

from pydantic import BaseModel


class Message(BaseModel):
    """Single conversation message."""

    role: str
    text: str


class TranscriptionResult(BaseModel):
    """Result of audio transcription."""

    text: str = ""
    is_final: bool = False
    speaker: str = ""


class Project(BaseModel):
    """Project API model (response)."""

    id: str
    name: str
    context_text: str
    llm_model: str
    created_at: str
    updated_at: str
    files: list[str]
    token: str | None = None


class ProjectCreateRequest(BaseModel):
    """Request body for creating a project."""

    name: str


class ProjectUpdateRequest(BaseModel):
    """Request body for updating a project (PATCH)."""

    name: str | None = None
    context_text: str | None = None
    llm_model: str | None = None


class ProjectListResponse(BaseModel):
    """Response for list projects."""

    projects: list[Project]


class SuggestionRequest(BaseModel):
    """Request body for generating suggestions."""

    history: list[Message]
    context: str = ""
    project_id: str | None = None


class SuggestionResponse(BaseModel):
    """Response with one generated reply to the interlocutor."""

    reply: str
