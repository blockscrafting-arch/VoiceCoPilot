"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator
import json
import os
import socket
import threading
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .logging_config import get_logger, setup_logging
from .routers import audio, context, health, projects, suggestions
from .services.db import init_db
from .services.transcription import get_transcription_service

logger = get_logger(__name__)

def _debug_log(hypothesis_id: str, message: str, data: dict) -> None:
    """Write debug payload to file only when VOICECOPILOT_DEBUG_LOG is set (e.g. local path)."""
    debug_path = os.getenv("VOICECOPILOT_DEBUG_LOG")
    if not debug_path:
        return
    payload = {
        "sessionId": "debug-session",
        "runId": "run1",
        "hypothesisId": hypothesis_id,
        "location": "main.py",
        "message": message,
        "data": data,
        "timestamp": int(__import__("time").time() * 1000),
    }
    try:
        Path(debug_path).parent.mkdir(parents=True, exist_ok=True)
        with open(debug_path, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager.

    Handles startup and shutdown events.

    Args:
        app: FastAPI application instance.

    Yields:
        None during application runtime.
    """
    # Startup
    setup_logging()
    logger.info("VoiceCoPilot API starting", version="0.1.0")
    try:
        init_db()
    except Exception as exc:
        logger.exception("Database init failed; app will start but projects may fail", error=str(exc))
    if settings.stt_provider == "openai" and not settings.openai_api_key:
        logger.warning(
            "STT_PROVIDER=openai but OPENAI_API_KEY is not set; transcription will return empty"
        )
    if settings.stt_provider == "local":
        def _warmup_stt() -> None:
            try:
                get_transcription_service().ensure_model_loaded()
            except Exception as exc:
                logger.warning("STT warmup failed; first transcription will be slower", error=str(exc))
        threading.Thread(target=_warmup_stt, daemon=True).start()
    ready_port = os.getenv("VOICECOPILOT_READY_PORT")
    if ready_port:
        try:
            with socket.create_connection(("127.0.0.1", int(ready_port)), timeout=2) as conn:
                conn.sendall(b"ready")
            # region agent log
            _debug_log("H5", "api_ready_sent", {"port": ready_port})
            # endregion
        except Exception as exc:
            # region agent log
            _debug_log("H5", "api_ready_failed", {"error": str(exc), "port": ready_port})
            # endregion
    yield
    # Shutdown
    logger.info("VoiceCoPilot API shutting down")


app = FastAPI(
    title="VoiceCoPilot API",
    description="Real-time voice assistance backend",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for desktop app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tauri app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(audio.router, prefix="/api/audio", tags=["audio"])
app.include_router(suggestions.router, prefix="/api/suggestions", tags=["suggestions"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(context.router, prefix="/api/projects", tags=["context"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "voicecopilot_api.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )
