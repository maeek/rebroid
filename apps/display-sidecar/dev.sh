#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

export NODE_ENV="${NODE_ENV:-development}"
export PORT="${PORT:-8000}"
if [ -z "${DISPLAY_SIDECAR_SHARED_SECRET:-}" ] && [ -z "${DISPLAY_SIDECAR_SHARED_SECRET_FILE:-}" ]; then
  DISPLAY_SIDECAR_SHARED_SECRET="$(
    if [ -z "${ORCHESTRATOR_SHARED_SECRET:-}" ] && [ -f ../orchestrator/.env ]; then
      . ../orchestrator/.env
    fi
    printf '%s' "${ORCHESTRATOR_SHARED_SECRET:-change-me}"
  )"
  export DISPLAY_SIDECAR_SHARED_SECRET
fi
export DISPLAY_WEBRTC_UDP_PORT_RANGE="${DISPLAY_WEBRTC_UDP_PORT_RANGE:-40000-40100}"

corepack pnpm build
exec corepack pnpm start
