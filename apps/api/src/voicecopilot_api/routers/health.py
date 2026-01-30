"""Health check endpoints."""

from fastapi import APIRouter

from ..config import settings

router = APIRouter()


@router.get("/health")
async def health_check() -> dict:
    """Check API health status.

    Returns:
        Dictionary with status and STT config (for debugging).
    """
    return {
        "status": "ok",
        "stt_provider": settings.stt_provider,
        "stt_chunk_seconds": settings.stt_chunk_seconds,
        "openai_stt_model": settings.openai_stt_model if settings.stt_provider == "openai" else None,
    }


@router.get("/ready")
async def readiness_check() -> dict[str, str]:
    """Check if API is ready to serve requests.

    Returns:
        Dictionary with status field.
    """
    # TODO: Check STT model loaded, OpenRouter reachable
    return {"status": "ready"}
