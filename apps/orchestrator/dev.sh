#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

detect_docker_socket() {
  if [ -n "${DOCKER_SOCKET_PATH:-}" ] && [ -S "$DOCKER_SOCKET_PATH" ]; then
    printf '%s\n' "$DOCKER_SOCKET_PATH"
    return
  fi

  for candidate in \
    /var/run/docker.sock \
    "${HOME:-}/.local/share/containers/podman/machine/podman.sock"; do
    if [ -S "$candidate" ]; then
      printf '%s\n' "$candidate"
      return
    fi
  done

  find /var/folders -path '*/podman/machine-api.sock' -type s -print 2>/dev/null | head -n 1
}

if [ -n "${DOCKER_HOST:-}" ]; then
  case "$DOCKER_HOST" in
    unix://* | tcp://* | http://* | https://*) ;;
    *)
      if [ -S "$DOCKER_HOST" ]; then
        export DOCKER_HOST="unix://$DOCKER_HOST"
      fi
      ;;
  esac
else
  detected_socket="$(detect_docker_socket)"
  if [ -n "$detected_socket" ]; then
    export DOCKER_SOCKET_PATH="$detected_socket"
  fi
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
