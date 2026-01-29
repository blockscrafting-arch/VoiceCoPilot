#!/bin/sh
set -eu

PORT_VALUE="${PORT-}"
if [ -z "$PORT_VALUE" ]; then
  PORT_VALUE="4173"
fi

echo "[entrypoint] PORT=${PORT-<unset>}"
echo "[entrypoint] listen=tcp://0.0.0.0:${PORT_VALUE}"

exec serve -s dist -l "tcp://0.0.0.0:${PORT_VALUE}"
