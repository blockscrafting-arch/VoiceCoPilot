"""Health check endpoints."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Check API health status.

    Returns:
        Dictionary with status field.
    """
    return {"status": "ok"}


@router.get("/ready")
async def readiness_check() -> dict[str, str]:
    """Check if API is ready to serve requests.

    Returns:
        Dictionary with status field.
    """
    # TODO: Check STT model loaded, OpenRouter reachable
    return {"status": "ready"}
