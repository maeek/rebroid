#!/bin/sh
set -eu

ensure_runtime_permissions() {
  if [ "$(id -u)" != "0" ]; then
    return
  fi

  mkdir -p /app/data /app/secrets /data/secrets
  chown -R node:node /app/data /app/secrets /data/secrets 2>/dev/null || true
}

run_as_node() {
  if [ "$(id -u)" = "0" ]; then
    exec su-exec node "$@"
  fi

  exec "$@"
}

normalize_tls_hosts() {
  printf '%s' "${REBROID_TLS_HOSTS:-localhost,127.0.0.1}" \
    | tr ',' '\n' \
    | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' \
    | awk 'NF'
}

ensure_tls_certificate() {
  cert_dir="${REBROID_TLS_CERT_DIR:-/app/data/certificates}"
  cert_file="${REBROID_TLS_CERT_FILE:-$cert_dir/rebroid-web.crt}"
  key_file="${REBROID_TLS_KEY_FILE:-$cert_dir/rebroid-web.key}"
  hosts_file="$cert_dir/hosts.txt"
  config_file="$cert_dir/openssl.cnf"
  normalized_hosts="$(normalize_tls_hosts)"

  mkdir -p "$cert_dir"

  if [ -z "$normalized_hosts" ]; then
    normalized_hosts="localhost
127.0.0.1"
  fi

  should_generate=0
  if [ ! -s "$cert_file" ] || [ ! -s "$key_file" ] || [ ! -s "$hosts_file" ]; then
    should_generate=1
  elif [ "$(cat "$hosts_file")" != "$normalized_hosts" ]; then
    should_generate=1
  fi

  if [ "$should_generate" -eq 0 ]; then
    export REBROID_TLS_CERT_FILE="$cert_file"
    export REBROID_TLS_KEY_FILE="$key_file"
    return
  fi

  first_host="$(printf '%s\n' "$normalized_hosts" | head -n 1)"
  alt_names="$(printf '%s\n' "$normalized_hosts" | node -e '
const fs = require("node:fs");
const hosts = fs.readFileSync(0, "utf8").split(/\r?\n/).map(v => v.trim()).filter(Boolean);
let dns = 0;
let ip = 0;
for (const host of hosts) {
  if (/^[0-9a-f:.]+$/i.test(host)) {
    ip += 1;
    console.log(`IP.${ip} = ${host}`);
  } else {
    dns += 1;
    console.log(`DNS.${dns} = ${host}`);
  }
}
')"

  cat > "$config_file" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
x509_extensions = v3_req
distinguished_name = dn

[dn]
CN = $first_host

[v3_req]
subjectAltName = @alt_names
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
$alt_names
EOF

  openssl req \
    -x509 \
    -nodes \
    -newkey rsa:2048 \
    -days "${REBROID_TLS_CERT_DAYS:-825}" \
    -keyout "$key_file" \
    -out "$cert_file" \
    -config "$config_file" >/dev/null 2>&1

  printf '%s' "$normalized_hosts" > "$hosts_file"
  chmod 600 "$key_file" 2>/dev/null || true
  chmod 644 "$cert_file" "$hosts_file" 2>/dev/null || true

  export REBROID_TLS_CERT_FILE="$cert_file"
  export REBROID_TLS_KEY_FILE="$key_file"
}

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

  secret_file="${ORCHESTRATOR_SHARED_SECRET_FILE:-/app/secrets/rebroid-shared-secret}"
  legacy_secret_file="/app/secrets/orchestrator-secret"
  if [ ! -s "$secret_file" ] && [ -s "$legacy_secret_file" ]; then
    mkdir -p "$(dirname "$secret_file")"
    cp "$legacy_secret_file" "$secret_file"
  fi
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

ensure_runtime_permissions
ensure_tls_certificate
read_shared_orchestrator_secret
read_or_create_secret NEXTAUTH_SECRET "${NEXTAUTH_SECRET_FILE:-/app/data/nextauth-secret}"

if [ -z "${INITIAL_ADMIN_PASSWORD:-}" ] && [ ! -s "$WEB_USERS_PATH" ]; then
  initial_password_file="${INITIAL_ADMIN_PASSWORD_FILE:-/app/data/initial-admin-password}"
  ensure_secret_file "$initial_password_file"
  export INITIAL_ADMIN_PASSWORD="$(cat "$initial_password_file")"
  echo "Initial Rebroid admin credentials: username=admin password=$INITIAL_ADMIN_PASSWORD" >&2
  echo "This password is shown only while the first users file is being created." >&2
fi

ensure_runtime_permissions
run_as_node "$@"
