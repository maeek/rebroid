#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

export NODE_ENV="${NODE_ENV:-development}"
export PORT="${PORT:-4100}"
export ORCHESTRATOR_SHARED_SECRET="${ORCHESTRATOR_SHARED_SECRET:-change-me}"
export DISPLAY_SIDECAR_INTERNAL_BASE_URL="${DISPLAY_SIDECAR_INTERNAL_BASE_URL:-http://localhost:8000}"
export DISPLAY_SIDECAR_AUTO_START="${DISPLAY_SIDECAR_AUTO_START:-false}"
export FIREWALL_AGENT_SOCKET="${FIREWALL_AGENT_SOCKET:-/tmp/rebroid-firewall/agent.sock}"
export FIREWALL_AGENT_SHARED_SECRET="${FIREWALL_AGENT_SHARED_SECRET:-$ORCHESTRATOR_SHARED_SECRET}"
export FIREWALL_POLICY_BOOTSTRAP="${FIREWALL_POLICY_BOOTSTRAP:-false}"

exec corepack pnpm dev
