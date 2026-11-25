#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

if [ -f .env.local ]; then
  set -a
  . ./.env.local
  set +a
fi

export PORT="${PORT:-3000}"
export ORCHESTRATOR_API_URL="${ORCHESTRATOR_API_URL:-http://localhost:4100}"
: "${ORCHESTRATOR_SHARED_SECRET:?Set ORCHESTRATOR_SHARED_SECRET in .env.local}"
: "${NEXTAUTH_SECRET:?Set NEXTAUTH_SECRET in .env.local}"
: "${MFA_ENCRYPTION_KEY:?Set MFA_ENCRYPTION_KEY in .env.local}"
: "${INITIAL_ADMIN_PASSWORD:?Set INITIAL_ADMIN_PASSWORD in .env.local}"
export AUTH_TRUST_HOST="${AUTH_TRUST_HOST:-false}"
export NEXT_ALLOWED_DEV_ORIGINS="${NEXT_ALLOWED_DEV_ORIGINS:-localhost,127.0.0.1}"
export DEV_HOST="${DEV_HOST:-127.0.0.1}"

if [ "${REBROID_KEEP_NEXTAUTH_URL:-false}" != "true" ]; then
  unset NEXTAUTH_URL AUTH_URL
fi

set -- next dev --experimental-https --hostname "$DEV_HOST" -p "$PORT"
if [ -n "${DEV_HTTPS_KEY:-}${DEV_HTTPS_CERT:-}" ]; then
  : "${DEV_HTTPS_KEY:?Set DEV_HTTPS_KEY with DEV_HTTPS_CERT}"
  : "${DEV_HTTPS_CERT:?Set DEV_HTTPS_CERT with DEV_HTTPS_KEY}"
  set -- "$@" --experimental-https-key "$DEV_HTTPS_KEY" --experimental-https-cert "$DEV_HTTPS_CERT"
fi

exec corepack pnpm exec "$@"
