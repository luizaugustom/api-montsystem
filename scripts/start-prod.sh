#!/bin/sh
set -eu

echo "[boot] NODE_ENV=${NODE_ENV:-} PORT=${PORT:-3000} DATABASE_HOST=${DATABASE_HOST:-} DATABASE_PORT=${DATABASE_PORT:-} DATABASE_NAME=${DATABASE_NAME:-} DATABASE_SSL=${DATABASE_SSL:-}"
echo "[boot] CORS_ORIGINS=${CORS_ORIGINS:-<vazio>}"

missing=""
[ -z "${JWT_SECRET:-}" ] && missing="$missing JWT_SECRET"
[ -z "${DATABASE_HOST:-}" ] && missing="$missing DATABASE_HOST"
[ -z "${DATABASE_USER:-}" ] && missing="$missing DATABASE_USER"
[ -z "${DATABASE_PASSWORD:-}" ] && missing="$missing DATABASE_PASSWORD"
[ -z "${DATABASE_NAME:-}" ] && missing="$missing DATABASE_NAME"
# Managed DO / prod: CORS é obrigatório (senão o browser bloqueia o front)
if [ -z "${CORS_ORIGINS:-}" ]; then
  if [ "${NODE_ENV:-}" = "production" ] || [ "${DATABASE_SSL:-}" = "true" ]; then
    missing="$missing CORS_ORIGINS"
  fi
fi
if [ -n "$missing" ]; then
  echo "[boot] FATAL: missing required env:$missing" >&2
  exit 1
fi

echo "[boot] running migrations (timeout 45s)..."
echo "[boot] HINT: se travar aqui, no Managed DB → Settings → Trusted Sources → adicione este App Platform (ou Allow App Platform)."
set +e
timeout 45 node ./node_modules/typeorm/cli.js migration:run -d dist/src/data-source.js
migrate_status=$?
set -e
if [ "$migrate_status" -ne 0 ]; then
  echo "[boot] FATAL: migrations falharam (exit=$migrate_status)." >&2
  echo "[boot] Causas comuns: Trusted Sources bloqueando o App, senha/host errados, database 'montsystem' inexistente." >&2
  exit "$migrate_status"
fi

echo "[boot] migrations ok — starting API on 0.0.0.0:${PORT:-3000}"
exec node dist/src/main.js
