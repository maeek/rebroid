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
export ORCHESTRATOR_SHARED_SECRET="${ORCHESTRATOR_SHARED_SECRET:-change-me}"
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-dev-secret}"
export INITIAL_ADMIN_PASSWORD="${INITIAL_ADMIN_PASSWORD:-admin}"
export AUTH_TRUST_HOST="${AUTH_TRUST_HOST:-true}"
export NEXT_ALLOWED_DEV_ORIGINS="${NEXT_ALLOWED_DEV_ORIGINS:-10.10.0.*,192.168.*.*,172.*.*.*,*.local}"

if [ "${REBROID_KEEP_NEXTAUTH_URL:-false}" != "true" ]; then
  unset NEXTAUTH_URL AUTH_URL
fi

exec corepack pnpm exec next dev --experimental-https --hostname 0.0.0.0 -p "$PORT"
