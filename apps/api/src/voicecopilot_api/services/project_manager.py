"""Project storage and context management service (database-backed)."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from contextlib import contextmanager
from typing import Any, Iterator

from sqlalchemy import select

from ..config import settings
from ..logging_config import get_logger
from .db import SessionLocal
from .models import ProjectRecord
from .storage import get_storage_client

logger = get_logger(__name__)


@dataclass
class ProjectData:
    """Project metadata and context stored in the database."""

    project_id: str
    name: str
    context_text: str
    llm_model: str
    created_at: str
    updated_at: str
    files: list[str]
    token: str

    def to_dict(self, include_token: bool = False) -> dict[str, Any]:
        """Convert the project data into a serializable dict."""
        payload = {
            "id": self.project_id,
            "name": self.name,
            "context_text": self.context_text,
            "llm_model": self.llm_model,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "files": self.files,
        }
        if include_token:
            payload["token"] = self.token
        return payload

    @classmethod
    def from_record(cls, record: ProjectRecord) -> "ProjectData":
        """Create ProjectData from ORM record."""
        return cls(
            project_id=record.id,
            name=record.name,
            context_text=record.context_text or "",
            llm_model=record.llm_model or settings.llm_model,
            created_at=record.created_at,
            updated_at=record.updated_at,
            files=list(record.files or []),
            token=record.token,
        )


def _now_iso() -> str:
    """Return current UTC time as ISO string."""
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def _session() -> Iterator:
    """Yield a database session."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _generate_token() -> str:
    """Generate a secure access token."""
    return secrets.token_urlsafe(24)


def list_projects(token: str) -> list[ProjectData]:
    """List all projects for a token."""
    with _session() as session:
        stmt = select(ProjectRecord).where(ProjectRecord.token == token)
        records = session.execute(stmt).scalars().all()
        return [ProjectData.from_record(record) for record in records]


def get_project(project_id: str, token: str | None = None) -> ProjectData | None:
    """Fetch a project by id, optionally scoped by token."""
    with _session() as session:
        stmt = select(ProjectRecord).where(ProjectRecord.id == project_id)
        if token:
            stmt = stmt.where(ProjectRecord.token == token)
        record = session.execute(stmt).scalars().first()
        return ProjectData.from_record(record) if record else None


def create_project(name: str, token: str | None = None) -> ProjectData:
    """Create a new project."""
    project_token = token or _generate_token()
    project_id = _sanitize_project_id(name)
    now = _now_iso()

    with _session() as session:
        existing = session.get(ProjectRecord, project_id)
        if existing:
            project_id = f"{project_id}-{secrets.token_hex(2)}"

        record = ProjectRecord(
            id=project_id,
            name=name,
            context_text="",
            llm_model=settings.llm_model,
            created_at=now,
            updated_at=now,
            files=[],
            token=project_token,
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        return ProjectData.from_record(record)


def update_project(
    project_id: str,
    token: str,
    name: str | None = None,
    context_text: str | None = None,
    llm_model: str | None = None,
    files: list[str] | None = None,
) -> ProjectData | None:
    """Update project metadata and save it."""
    with _session() as session:
        stmt = select(ProjectRecord).where(
            ProjectRecord.id == project_id, ProjectRecord.token == token
        )
        record = session.execute(stmt).scalars().first()
        if not record:
            return None

        if name is not None:
            record.name = name
        if context_text is not None:
            record.context_text = context_text
        if llm_model is not None:
            record.llm_model = llm_model
        if files is not None:
            record.files = files

        record.updated_at = _now_iso()
        session.commit()
        session.refresh(record)
        return ProjectData.from_record(record)


def add_context_file(
    project_id: str,
    token: str,
    filename: str,
    content: bytes,
) -> ProjectData | None:
    """Save a context file to storage and register it in the project."""
    project = get_project(project_id, token=token)
    if not project:
        return None

    key = f"projects/{project_id}/context_files/{filename}"
    storage = get_storage_client()
    try:
        storage.upload_bytes(key, content, "application/octet-stream")
    except Exception as exc:
        logger.exception("Failed to upload context file", error=str(exc))
        return None

    files = list(project.files)
    files.append(filename)
    return update_project(project_id, token, files=files)


def _sanitize_project_id(name: str) -> str:
    """Generate a safe project id from the display name."""
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in name)
    cleaned = "-".join(segment for segment in cleaned.split("-") if segment)
    return cleaned or "project"
"""Project storage and context management service."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..config import settings
from ..logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class ProjectData:
    """Project metadata and context stored on disk."""

    project_id: str
    name: str
    context_text: str
    llm_model: str
    created_at: str
    updated_at: str
    files: list[str]

    def to_dict(self) -> dict[str, Any]:
        """Convert the project data into a serializable dict."""
        return {
            "id": self.project_id,
            "name": self.name,
            "context_text": self.context_text,
            "llm_model": self.llm_model,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "files": self.files,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "ProjectData":
        """Create ProjectData from stored JSON."""
        return cls(
            project_id=payload.get("id", ""),
            name=payload.get("name", ""),
            context_text=payload.get("context_text", ""),
            llm_model=payload.get("llm_model", settings.llm_model),
            created_at=payload.get("created_at", ""),
            updated_at=payload.get("updated_at", ""),
            files=list(payload.get("files", [])),
        )


def _now_iso() -> str:
    """Return current UTC time as ISO string."""
    return datetime.now(timezone.utc).isoformat()


def _projects_root() -> Path:
    """Resolve the projects directory (next to the app/exe)."""
    base = Path.cwd()
    return base / "projects"


def _project_dir(project_id: str) -> Path:
    """Return directory path for a given project."""
    return _projects_root() / project_id


def _context_path(project_id: str) -> Path:
    """Return context.json path for a given project."""
    return _project_dir(project_id) / "context.json"


def _sanitize_project_id(name: str) -> str:
    """Generate a safe project id from the display name."""
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "-", name.strip().lower()).strip("-")
    return cleaned or "project"


def _load_project(path: Path) -> ProjectData | None:
    """Load project from its context.json."""
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return ProjectData.from_dict(data)
    except Exception as exc:
        logger.warning("Failed to read project", path=str(path), error=str(exc))
        return None


def list_projects() -> list[ProjectData]:
    """List all stored projects."""
    root = _projects_root()
    if not root.exists():
        return []

    projects: list[ProjectData] = []
    for item in root.iterdir():
        if not item.is_dir():
            continue
        context_path = item / "context.json"
        project = _load_project(context_path)
        if project:
            projects.append(project)

    return projects


def get_project(project_id: str) -> ProjectData | None:
    """Fetch a project by id."""
    return _load_project(_context_path(project_id))


def create_project(name: str) -> ProjectData:
    """Create a new project folder and context file."""
    root = _projects_root()
    root.mkdir(parents=True, exist_ok=True)

    base_id = _sanitize_project_id(name)
    project_id = base_id
    counter = 1
    while _project_dir(project_id).exists():
        counter += 1
        project_id = f"{base_id}-{counter}"

    project_path = _project_dir(project_id)
    project_path.mkdir(parents=True, exist_ok=True)
    (project_path / "context_files").mkdir(parents=True, exist_ok=True)
    (project_path / "transcripts").mkdir(parents=True, exist_ok=True)

    now = _now_iso()
    project = ProjectData(
        project_id=project_id,
        name=name,
        context_text="",
        llm_model=settings.llm_model,
        created_at=now,
        updated_at=now,
        files=[],
    )
    _save_project(project)
    return project


def update_project(
    project_id: str,
    name: str | None = None,
    context_text: str | None = None,
    llm_model: str | None = None,
    files: list[str] | None = None,
) -> ProjectData | None:
    """Update project metadata and save it."""
    project = get_project(project_id)
    if not project:
        return None

    if name is not None:
        project.name = name
    if context_text is not None:
        project.context_text = context_text
    if llm_model is not None:
        project.llm_model = llm_model
    if files is not None:
        project.files = files

    project.updated_at = _now_iso()
    _save_project(project)
    return project


def add_context_file(project_id: str, filename: str, content: bytes) -> ProjectData | None:
    """Save a context file inside the project and register it."""
    project = get_project(project_id)
    if not project:
        return None

    files_dir = _project_dir(project_id) / "context_files"
    files_dir.mkdir(parents=True, exist_ok=True)
    target_path = files_dir / filename
    target_path.write_bytes(content)

    project.files.append(filename)
    project.updated_at = _now_iso()
    _save_project(project)
    return project


def _save_project(project: ProjectData) -> None:
    """Persist a project to context.json."""
    context_path = _context_path(project.project_id)
    context_path.parent.mkdir(parents=True, exist_ok=True)
    context_path.write_text(
        json.dumps(project.to_dict(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
