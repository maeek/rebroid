#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

export FIREWALL_AGENT_SOCKET="${FIREWALL_AGENT_SOCKET:-/tmp/rebroid-firewall/agent.sock}"
export FIREWALL_AGENT_STATE_PATH="${FIREWALL_AGENT_STATE_PATH:-/tmp/rebroid-firewall/policies.json}"
export FIREWALL_AGENT_SHARED_SECRET="${FIREWALL_AGENT_SHARED_SECRET:-change-me}"
export FIREWALL_ADAPTER="${FIREWALL_ADAPTER:-auto}"

corepack pnpm build
exec corepack pnpm start
