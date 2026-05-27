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
export ORCHESTRATOR_INTERNAL_DOCKER="${ORCHESTRATOR_INTERNAL_DOCKER:-auto}"
export DOCKER_DATA_ROOT="${DOCKER_DATA_ROOT:-/var/lib/docker}"
export DOCKER_STORAGE_DRIVER="${DOCKER_STORAGE_DRIVER:-vfs}"

start_internal_docker() {
  socket_dir="$(dirname "$DOCKER_SOCKET_PATH")"
  mkdir -p "$socket_dir" "$DOCKER_DATA_ROOT"

  dockerd \
    --host="unix://$DOCKER_SOCKET_PATH" \
    --data-root="$DOCKER_DATA_ROOT" \
    --storage-driver="$DOCKER_STORAGE_DRIVER" \
    >/tmp/rebroid-dockerd.log 2>&1 &

  echo "Starting internal dockerd on $DOCKER_SOCKET_PATH"

  attempts=0
  until docker --host "unix://$DOCKER_SOCKET_PATH" info >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 30 ]; then
      echo "Internal dockerd failed to start"
      cat /tmp/rebroid-dockerd.log >&2 || true
      exit 1
    fi
    sleep 1
  done
}

if [ -z "${DOCKER_HOST:-}" ]; then
  if [ -S "$DOCKER_SOCKET_PATH" ]; then
    echo "Using external container engine socket at $DOCKER_SOCKET_PATH"
  elif [ "$ORCHESTRATOR_INTERNAL_DOCKER" = "false" ]; then
    echo "No container engine socket found at $DOCKER_SOCKET_PATH and internal Docker is disabled" >&2
    exit 1
  else
    start_internal_docker
  fi
fi

if [ -z "${ORCHESTRATOR_SHARED_SECRET:-}" ]; then
  secret_file="${ORCHESTRATOR_SHARED_SECRET_FILE:-/app/secrets/rebroid-shared-secret}"
  legacy_secret_file="/app/secrets/orchestrator-secret"
  if [ ! -s "$secret_file" ] && [ -s "$legacy_secret_file" ]; then
    mkdir -p "$(dirname "$secret_file")"
    cp "$legacy_secret_file" "$secret_file"
  fi
  ensure_secret_file "$secret_file"
  chmod 644 "$secret_file" 2>/dev/null || true
  export ORCHESTRATOR_SHARED_SECRET="$(cat "$secret_file")"
fi

exec "$@"
