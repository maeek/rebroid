#!/bin/sh
set -eu

create_secret() {
  node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"
}

ensure_secret_file() {
  file_path="$1"
  mkdir -p "$(dirname "$file_path")"
  if [ ! -s "$file_path" ]; then
    create_secret > "$file_path"
    chmod 600 "$file_path" 2>/dev/null || true
  fi
}

export DATABASE_PATH="${DATABASE_PATH:-/app/data/orchestrator.sqlite}"
export SETTINGS_PATH="${SETTINGS_PATH:-/app/data/orchestrator-settings.json}"
export UPLOADS_DIR="${UPLOADS_DIR:-/app/uploads}"
export DOCKER_SOCKET_PATH="${DOCKER_SOCKET_PATH:-/var/run/docker.sock}"

if [ -z "${DOCKER_HOST:-}" ] && [ ! -S "$DOCKER_SOCKET_PATH" ]; then
  echo "No external Docker-compatible engine socket found at $DOCKER_SOCKET_PATH" >&2
  exit 1
fi

if [ -z "${ORCHESTRATOR_SHARED_SECRET:-}" ]; then
  secret_file="${ORCHESTRATOR_SHARED_SECRET_FILE:-/app/secrets/rebroid-shared-secret}"
  ensure_secret_file "$secret_file"
  chmod 600 "$secret_file" 2>/dev/null || true
  export ORCHESTRATOR_SHARED_SECRET="$(cat "$secret_file")"
fi
export FIREWALL_AGENT_SHARED_SECRET="${FIREWALL_AGENT_SHARED_SECRET:-$ORCHESTRATOR_SHARED_SECRET}"

exec "$@"
