#!/bin/sh
set -eu

raw_hosts="${REBROID_PUBLIC_HOSTS:-${REBROID_TLS_HOSTS:-localhost,127.0.0.1}}"
server_names="$(printf '%s' "$raw_hosts" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | awk 'NF' | tr '\n' ' ') rebroid-web"

if [ -z "$server_names" ]; then
  server_names="localhost 127.0.0.1"
fi

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
