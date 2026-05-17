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

read_or_create_secret() {
  env_name="$1"
  file_path="$2"
  current_value="$(eval "printf '%s' \"\${$env_name:-}\"")"

  if [ -n "$current_value" ]; then
    return
  fi

  ensure_secret_file "$file_path"
  export "$env_name=$(cat "$file_path")"
}

read_shared_orchestrator_secret() {
  if [ -n "${ORCHESTRATOR_SHARED_SECRET:-}" ]; then
    return
  fi

  secret_file="${ORCHESTRATOR_SHARED_SECRET_FILE:-/app/secrets/orchestrator-secret}"
  attempts=0
  while [ ! -s "$secret_file" ] && [ "$attempts" -lt 30 ]; do
    attempts=$((attempts + 1))
    sleep 1
  done

  if [ ! -s "$secret_file" ]; then
    echo "Orchestrator shared secret file was not created yet; generating a local one." >&2
    ensure_secret_file "$secret_file"
  fi

  chmod 644 "$secret_file" 2>/dev/null || true
  export ORCHESTRATOR_SHARED_SECRET="$(cat "$secret_file")"
}

export ORCHESTRATOR_API_URL="${ORCHESTRATOR_API_URL:-http://orchestrator:4100}"
export WEB_SETTINGS_PATH="${WEB_SETTINGS_PATH:-/app/data/web-settings.json}"
export WEB_USERS_PATH="${WEB_USERS_PATH:-/app/data/users.json}"
export WEB_APP_ICONS_PATH="${WEB_APP_ICONS_PATH:-/app/data/app-icons}"

read_shared_orchestrator_secret
read_or_create_secret NEXTAUTH_SECRET "${NEXTAUTH_SECRET_FILE:-/app/data/nextauth-secret}"
read_or_create_secret SCRCPY_VIEWER_TOKEN_SECRET "${SCRCPY_VIEWER_TOKEN_SECRET_FILE:-/app/data/viewer-token-secret}"

if [ -z "${INITIAL_ADMIN_PASSWORD:-}" ] && [ ! -s "$WEB_USERS_PATH" ]; then
  initial_password_file="${INITIAL_ADMIN_PASSWORD_FILE:-/app/data/initial-admin-password}"
  ensure_secret_file "$initial_password_file"
  export INITIAL_ADMIN_PASSWORD="$(cat "$initial_password_file")"
  echo "Initial Shop Me Alone admin credentials: username=admin password=$INITIAL_ADMIN_PASSWORD" >&2
  echo "This password is shown only while the first users file is being created." >&2
fi

exec "$@"
