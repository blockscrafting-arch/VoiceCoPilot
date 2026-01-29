#!/bin/sh
set -eu

PORT_VALUE="${PORT:-8000}"
echo "[api entrypoint] PORT=$PORT_VALUE"
exec uvicorn voicecopilot_api.main:app --host 0.0.0.0 --port "$PORT_VALUE"
