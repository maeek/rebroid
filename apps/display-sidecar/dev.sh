#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

export NODE_ENV="${NODE_ENV:-development}"
export WEB_INTERNAL_URL="${WEB_INTERNAL_URL:-https://127.0.0.1:3000}"
export NODE_USE_SYSTEM_CA="${NODE_USE_SYSTEM_CA:-1}"

read_external_config() (
  if [ -f ../orchestrator/.env ]; then
    . ../orchestrator/.env
  fi
  case "$1" in
    url) printf '%s' "${EXTERNAL_ADB_BROKER_URL:-}" ;;
    secret) printf '%s' "${EXTERNAL_ADB_BROKER_SECRET:-}" ;;
    endpoints) printf '%s' "${EXTERNAL_ADB_TCP_ENDPOINTS:-}" ;;
  esac
)

broker_url="${EXTERNAL_ADB_BROKER_URL:-$(read_external_config url)}"
broker_secret="${EXTERNAL_ADB_BROKER_SECRET:-$(read_external_config secret)}"
broker_port="$(node -e '
  const url = URL.parse(process.argv[1])
  if (url?.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) {
    process.stdout.write(url.port || "80")
  }
' "$broker_url")"

start_broker() {
  export EXTERNAL_ADB_ENABLED=true
  export PORT="$1"
  export DISPLAY_SIDECAR_BIND_HOST=127.0.0.1
  export DISPLAY_WEBRTC_UDP_PORT="${EXTERNAL_ADB_DEV_UDP_PORT:-40002}"
  export DISPLAY_SIDECAR_SHARED_SECRET="$broker_secret"
  export EXTERNAL_ADB_TCP_ENDPOINTS="${EXTERNAL_ADB_TCP_ENDPOINTS:-$(read_external_config endpoints)}"
  export EXTERNAL_ADB_KEYS_DIRECTORY="${EXTERNAL_ADB_KEYS_DIRECTORY:-./data/external-adb-keys}"
  exec node dist/main.js
}

start_managed() {
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
  export DISPLAY_WEBRTC_UDP_PORT="${DISPLAY_WEBRTC_UDP_PORT:-40000}"
  exec node dist/main.js
}

if [ "${1:-}" = "--external-adb" ]; then
  if [ "${#broker_secret}" -lt 32 ]; then
    echo 'Set EXTERNAL_ADB_BROKER_SECRET to at least 32 characters in apps/orchestrator/.env.' >&2
    exit 1
  fi
  corepack pnpm --filter @rebroid/android-application-core build
  corepack pnpm build
  start_broker "${EXTERNAL_ADB_DEV_PORT:-${broker_port:-8001}}"
fi

if [ -n "$broker_port" ] && [ "${#broker_secret}" -ge 32 ]; then
  corepack pnpm --filter @rebroid/android-application-core build
fi
corepack pnpm build

if [ -z "$broker_port" ] || [ "${#broker_secret}" -lt 32 ]; then
  start_managed
fi

broker_pid=
managed_pid=
stop_sidecars() {
  trap - 0 INT TERM
  if [ -n "$broker_pid" ]; then
    kill "$broker_pid" 2>/dev/null || true
  fi
  if [ -n "$managed_pid" ]; then
    kill "$managed_pid" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}
trap stop_sidecars 0
trap 'exit 130' INT
trap 'exit 143' TERM
printf 'Starting external ADB broker on http://127.0.0.1:%s\n' "$broker_port"
start_broker "$broker_port" &
broker_pid=$!
start_managed &
managed_pid=$!
wait "$managed_pid"
