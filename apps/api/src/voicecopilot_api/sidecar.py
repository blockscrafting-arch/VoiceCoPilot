"""Sidecar entry point for the bundled API server."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

DEBUG_LOG_PATH = r"d:\vladexecute\proj\VoiceCoPilot\.cursor\debug.log"


def _debug_log(hypothesis_id: str, message: str, data: dict) -> None:
    payload = {
        "sessionId": "debug-session",
        "runId": "run1",
        "hypothesisId": hypothesis_id,
        "location": "sidecar.py:15",
        "message": message,
        "data": data,
        "timestamp": int(__import__("time").time() * 1000),
    }
    try:
        Path(DEBUG_LOG_PATH).parent.mkdir(parents=True, exist_ok=True)
        with open(DEBUG_LOG_PATH, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except Exception:
        pass


# region agent log
_debug_log(
    "H1",
    "sidecar_import_start",
    {"package": __package__, "path_len": len(sys.path)},
)
# endregion
try:
    from .config import settings
    from .logging_config import setup_logging
    # region agent log
    _debug_log(
        "H1",
        "sidecar_import_relative_ok",
        {"package": __package__},
    )
    # endregion
except Exception as exc:  # pragma: no cover - debug instrumentation
    # region agent log
    _debug_log(
        "H1",
        "sidecar_import_relative_failed",
        {"error": str(exc), "package": __package__},
    )
    # endregion
    try:
        from voicecopilot_api.config import settings
        from voicecopilot_api.logging_config import setup_logging
        # region agent log
        _debug_log(
            "H1",
            "sidecar_import_absolute_ok",
            {"package": __package__},
        )
        # endregion
    except Exception as exc2:  # pragma: no cover - debug instrumentation
        # region agent log
        _debug_log(
            "H1",
            "sidecar_import_absolute_failed",
            {"error": str(exc2), "package": __package__},
        )
        # endregion
        raise

# region agent log
_debug_log(
    "H1",
    "sidecar_app_import_start",
    {"package": __package__},
)
# endregion
try:
    from .main import app as fastapi_app
    # region agent log
    _debug_log(
        "H1",
        "sidecar_app_import_relative_ok",
        {"module": "voicecopilot_api.main"},
    )
    # endregion
except Exception as exc:  # pragma: no cover - debug instrumentation
    # region agent log
    _debug_log(
        "H1",
        "sidecar_app_import_relative_failed",
        {"error": str(exc)},
    )
    # endregion
    try:
        from voicecopilot_api.main import app as fastapi_app
        # region agent log
        _debug_log(
            "H1",
            "sidecar_app_import_absolute_ok",
            {"module": "voicecopilot_api.main"},
        )
        # endregion
    except Exception as exc2:  # pragma: no cover - debug instrumentation
        # region agent log
        _debug_log(
            "H1",
            "sidecar_app_import_absolute_failed",
            {"error": str(exc2)},
        )
        # endregion
        raise


def _redirect_output() -> None:
    """Redirect stdout/stderr to a log file if configured."""
    log_path = os.getenv("VOICECOPILOT_LOG_PATH")
    if not log_path:
        return

    path = Path(log_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    stream = path.open("a", encoding="utf-8", buffering=1)
    sys.stdout = stream
    sys.stderr = stream


def main() -> None:
    """Start the FastAPI server for the Tauri sidecar."""
    import uvicorn

    _redirect_output()
    setup_logging()
    print("Sidecar starting...")
    # region agent log
    _debug_log(
        "H1",
        "sidecar_uvicorn_start",
        {"host": settings.api_host, "port": settings.api_port},
    )
    # endregion
    uvicorn.run(
        fastapi_app,
        host=settings.api_host,
        port=settings.api_port,
        reload=False,
    )


if __name__ == "__main__":
    main()
