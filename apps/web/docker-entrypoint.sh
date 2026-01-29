#!/bin/sh
set -eu

PORT_VALUE="${PORT-}"
if [ -z "$PORT_VALUE" ]; then
  PORT_VALUE="4173"
fi

echo "[entrypoint] PORT=${PORT-<unset>}"
echo "[entrypoint] serve -s dist -l ${PORT_VALUE}"

exec serve -s dist -l "$PORT_VALUE"
