"""File parsing utilities for project context imports."""

from __future__ import annotations

from io import BytesIO

from ..logging_config import get_logger

logger = get_logger(__name__)


def parse_file(filename: str, content: bytes) -> str:
    """Parse supported file formats into plain text.

    Args:
        filename: Original file name.
        content: Raw file bytes.

    Returns:
        Extracted text content.
    """
    lower = filename.lower()
    if lower.endswith((".txt", ".md")):
        return content.decode("utf-8", errors="ignore")

    if lower.endswith(".pdf"):
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(content))
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    if lower.endswith(".docx"):
        from docx import Document

        document = Document(BytesIO(content))
        return "\n".join(p.text for p in document.paragraphs)

    raise ValueError("Unsupported file type")
