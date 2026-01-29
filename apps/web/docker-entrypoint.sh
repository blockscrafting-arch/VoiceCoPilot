#!/bin/sh
set -eu

PORT_VALUE="${PORT-}"
if [ -z "$PORT_VALUE" ]; then
  PORT_VALUE="4173"
fi

echo "[entrypoint] PORT=${PORT-<unset>}"
echo "[entrypoint] vite preview --host 0.0.0.0 --port ${PORT_VALUE}"

exec node_modules/.bin/vite preview --host 0.0.0.0 --port "$PORT_VALUE"
