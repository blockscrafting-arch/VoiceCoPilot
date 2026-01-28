"""Transcript saving utilities."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4
from ..logging_config import get_logger
from .db import SessionLocal
from .models import TranscriptRecord
from .project_manager import get_project
from .storage import get_storage_client

logger = get_logger(__name__)


def _timestamp() -> str:
    """Return an ISO timestamp in UTC."""
    return datetime.now(timezone.utc).isoformat()


def _transcript_filename() -> str:
    """Generate a timestamped transcript file name."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S_call.txt")


def save_transcript(project_id: str, entries: list[dict[str, str]]) -> str | None:
    """Save transcript entries to a project transcript file.

    Args:
        project_id: Project identifier.
        entries: List of transcript entries with speaker/text/time.

    Returns:
        Path to saved transcript or None if nothing saved.
    """
    if not entries:
        return None

    project = get_project(project_id)
    if not project:
        logger.warning("Project not found for transcript", project_id=project_id)
        return None

    transcript_key = f"projects/{project.project_id}/transcripts/{_transcript_filename()}"

    lines = []
    for entry in entries:
        timestamp = entry.get("timestamp") or _timestamp()
        speaker = entry.get("speaker") or "unknown"
        text = entry.get("text") or ""
        lines.append(f"[{timestamp}] {speaker}: {text}")

    content = "\n".join(lines)
    storage = get_storage_client()
    try:
        storage.upload_text(transcript_key, content)
    except Exception as exc:
        logger.exception("Failed to upload transcript", error=str(exc))
        return None

    record_id = str(uuid4())
    created_at = _timestamp()
    session = SessionLocal()
    try:
        record = TranscriptRecord(
            id=record_id,
            project_id=project.project_id,
            storage_key=transcript_key,
            created_at=created_at,
        )
        session.add(record)
        session.commit()
    finally:
        session.close()

    logger.info(
        "Transcript saved",
        project_id=project.project_id,
        path=transcript_key,
        entries=len(entries),
    )
    return transcript_key
