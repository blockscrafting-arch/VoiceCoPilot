#!/bin/sh
set -eu

PORT_VALUE="${PORT-}"
if [ -z "$PORT_VALUE" ]; then
  PORT_VALUE="4173"
fi

# Runtime config: API_URL -> dist/config.json (so frontend can reach the API in production)
# Escape " and \ so the value is valid JSON (API_URL should be a URL without quotes)
if [ -n "${API_URL-}" ]; then
  API_ESC="$(printf '%s' "$API_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  printf '{"apiUrl":"%s"}\n' "$API_ESC" > dist/config.json
  echo "[entrypoint] wrote dist/config.json with API_URL"
fi

echo "[entrypoint] PORT=${PORT-<unset>}"
echo "[entrypoint] serve -s dist -l tcp://0.0.0.0:${PORT_VALUE}"

exec serve -s dist -l "tcp://0.0.0.0:${PORT_VALUE}"
