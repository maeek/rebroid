#!/bin/sh
set -eu

raw_hosts="${REBROID_PUBLIC_HOSTS:-${REBROID_TLS_HOSTS:-}}"
if [ -z "$raw_hosts" ] && [ -s /app/data/certificates/hosts.txt ]; then
  raw_hosts="$(cat /app/data/certificates/hosts.txt)"
fi
server_names="$(printf '%s' "${raw_hosts:-localhost,127.0.0.1}" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | awk 'NF' | tr '\n' ' ') rebroid-web"

case "$server_names" in
  *[!A-Za-z0-9._:\ -]*)
    echo "REBROID_PUBLIC_HOSTS/REBROID_TLS_HOSTS contains an invalid host." >&2
    exit 1
    ;;
esac

export REBROID_NGINX_SERVER_NAMES="$server_names"
envsubst '${REBROID_NGINX_SERVER_NAMES}' \
  < /opt/rebroid-edge/nginx.conf.template \
  > /tmp/rebroid-nginx.conf

exec nginx -c /tmp/rebroid-nginx.conf -g 'daemon off;'
