#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
input_dir="${1:-${script_dir}/docker-images}"

resolve_container_engine() {
  if [[ -n "${CONTAINER_ENGINE_BIN:-}" ]]; then
    printf '%s\n' "${CONTAINER_ENGINE_BIN}"
    return
  fi

  if [[ -n "${PODMAN_BIN:-}" ]]; then
    printf '%s\n' "${PODMAN_BIN}"
    return
  fi

  if command -v docker >/dev/null 2>&1; then
    command -v docker
    return
  fi

  if command -v podman >/dev/null 2>&1; then
    command -v podman
    return
  fi

  echo "Docker or Podman is required." >&2
  exit 1
}

container_engine="$(resolve_container_engine)"

while read -r archive_name image_name; do
  [[ -n "${archive_name}" ]] || continue

  archive_path="${input_dir}/${archive_name}"
  if [[ ! -f "${archive_path}" ]]; then
    echo "Missing image archive: ${archive_path}" >&2
    exit 1
  fi

  echo "Loading ${archive_path}"
  "${container_engine}" image load --input "${archive_path}"

  if ! "${container_engine}" image inspect "${image_name}" >/dev/null 2>&1; then
    echo "Loaded archive does not contain expected image: ${image_name}" >&2
    exit 1
  fi
done <<'EOF'
rebroid-orchestrator-local.tar localhost/rebroid/orchestrator:local
rebroid-web-local.tar localhost/rebroid/web:local
rebroid-display-sidecar-local.tar localhost/rebroid/display-sidecar:local
rebroid-ocr-sidecar-local.tar localhost/rebroid/ocr-sidecar:local
rebroid-firewall-agent-local.tar localhost/rebroid/firewall-agent:local
rebroid-gapps-patcher-latest.tar rebroid/gapps-patcher:latest
EOF

echo "Loaded and verified Rebroid images from ${input_dir}"
