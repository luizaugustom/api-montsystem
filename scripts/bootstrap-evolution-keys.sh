#!/usr/bin/env bash
# =============================================================================
# bootstrap-evolution-keys.sh
# =============================================================================
# Gera EVOLUTION_API_KEY e EVOLUTION_WEBHOOK_SECRET em ./secrets/evolution.env
# quando rodando a API fora do docker-compose (npm run start:dev).
#
# Comportamento idêntico ao container `bootstrap-secrets` do docker-compose:
# - Se o arquivo já existe, não sobrescreve (idempotente).
# - Se EVOLUTION_API_KEY / EVOLUTION_WEBHOOK_SECRET já estão no .env do
#   projeto, usa esses valores.
# - Senão, gera 32 bytes hex aleatórios com openssl.
#
# Uso:
#   ./scripts/bootstrap-evolution-keys.sh          # gera se necessário
#   FORCE=1 ./scripts/bootstrap-evolution-keys.sh  # regenera sempre
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p secrets

ENV_FILE=".env"
SECRETS_FILE="secrets/evolution.env"

# Carrega valores do .env se existirem (sem exportar para o shell global)
load_env_value() {
  local key="$1"
  if [ -f "$ENV_FILE" ]; then
    grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^["'\'']//;s/["'\'']$//' || true
  fi
}

CUR_API=$(grep -E '^EVOLUTION_API_KEY=' "$SECRETS_FILE" 2>/dev/null | head -1 | cut -d= -f2- || true)
CUR_HOOK=$(grep -E '^EVOLUTION_WEBHOOK_SECRET=' "$SECRETS_FILE" 2>/dev/null | head -1 | cut -d= -f2- || true)

ENV_API=$(load_env_value EVOLUTION_API_KEY)
ENV_HOOK=$(load_env_value EVOLUTION_WEBHOOK_SECRET)

if [ "${FORCE:-0}" != "1" ] && [ -n "${CUR_API:-}" ] && [ -n "${CUR_HOOK:-}" ]; then
  echo "bootstrap-evolution-keys: chaves já existem em $SECRETS_FILE (use FORCE=1 para regenerar)"
  exit 0
fi

KEY_API="${ENV_API:-${CUR_API:-$(openssl rand -hex 32)}}"
KEY_HOOK="${ENV_HOOK:-${CUR_HOOK:-$(openssl rand -hex 32)}}"

cat > "$SECRETS_FILE" <<EOF
# Gerado por scripts/bootstrap-evolution-keys.sh em $(date -u +%Y-%m-%dT%H:%M:%SZ)
EVOLUTION_API_KEY=${KEY_API}
EVOLUTION_WEBHOOK_SECRET=${KEY_HOOK}
EOF
chmod 0644 "$SECRETS_FILE"

echo "bootstrap-evolution-keys: chaves aplicadas em $SECRETS_FILE"
echo "  EVOLUTION_API_KEY=${KEY_API:0:8}... (${#KEY_API} chars)"
echo "  EVOLUTION_WEBHOOK_SECRET=${KEY_HOOK:0:8}... (${#KEY_HOOK} chars)"
echo ""
echo "Próximos passos:"
echo "  • No compose, basta 'docker compose up' (o serviço bootstrap-secrets cuida)."
echo "  • Fora do compose, garanta que EVOLUTION_BASE_URL aponta para a Evolution"
echo "    e reinicie a api (npm run start:dev). Para a Evolution usar a mesma"
echo "    chave, defina AUTHENTICATION_API_KEY no ambiente dela."
