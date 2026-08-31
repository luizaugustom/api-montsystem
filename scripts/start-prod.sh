#!/bin/sh
set -eu

echo "[boot] NODE_ENV=${NODE_ENV:-} PORT=${PORT:-3000} DATABASE_HOST=${DATABASE_HOST:-} DATABASE_PORT=${DATABASE_PORT:-} DATABASE_NAME=${DATABASE_NAME:-} DATABASE_SSL=${DATABASE_SSL:-}"

missing=""
[ -z "${JWT_SECRET:-}" ] && missing="$missing JWT_SECRET"
[ -z "${DATABASE_HOST:-}" ] && missing="$missing DATABASE_HOST"
[ -z "${DATABASE_USER:-}" ] && missing="$missing DATABASE_USER"
[ -z "${DATABASE_PASSWORD:-}" ] && missing="$missing DATABASE_PASSWORD"
[ -z "${DATABASE_NAME:-}" ] && missing="$missing DATABASE_NAME"
if [ "${NODE_ENV:-}" = "production" ] && [ -z "${CORS_ORIGINS:-}" ]; then
  missing="$missing CORS_ORIGINS"
fi
if [ -n "$missing" ]; then
  echo "[boot] FATAL: missing required env:$missing" >&2
  exit 1
fi

echo "[boot] running migrations..."
node ./node_modules/typeorm/cli.js migration:run -d dist/src/data-source.js
echo "[boot] migrations ok — starting API on 0.0.0.0:${PORT:-3000}"
exec node dist/src/main.js
