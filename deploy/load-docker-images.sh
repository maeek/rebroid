#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
input_dir="${1:-${script_dir}/docker-images}"

container_engine="${CONTAINER_ENGINE_BIN:-${PODMAN_BIN:-}}"
if [[ -z "${container_engine}" ]]; then
  container_engine="$(command -v docker || command -v podman)" || {
    echo "Docker or Podman is required." >&2
    exit 1
  }
fi

while read -r archive_name image_name; do
  [[ -n "${archive_name}" ]] || continue

  archive_path="${input_dir}/${archive_name}"
  if [[ ! -f "${archive_path}" ]]; then
    echo "Missing image archive: ${archive_path}" >&2
    exit 1
  fi

  echo "Loading ${archive_path}"
  "${container_engine}" image load --input "${archive_path}"

  if [[ "${image_name}" == localhost/rebroid/gapps-patcher:latest ]] \
    && ! "${container_engine}" image inspect "${image_name}" >/dev/null 2>&1 \
    && "${container_engine}" image inspect rebroid/gapps-patcher:latest >/dev/null 2>&1; then
    "${container_engine}" image tag rebroid/gapps-patcher:latest "${image_name}"
  fi

  if ! "${container_engine}" image inspect "${image_name}" >/dev/null 2>&1; then
    echo "Loaded archive does not contain expected image: ${image_name}" >&2
    exit 1
  fi
done <<'EOF'
rebroid-orchestrator-local.tar localhost/rebroid/orchestrator:local
rebroid-web-local.tar localhost/rebroid/web:local
rebroid-edge-local.tar localhost/rebroid/edge:local
rebroid-display-sidecar-local.tar localhost/rebroid/display-sidecar:local
rebroid-ocr-sidecar-local.tar localhost/rebroid/ocr-sidecar:local
rebroid-firewall-agent-local.tar localhost/rebroid/firewall-agent:local
rebroid-gapps-patcher-latest.tar localhost/rebroid/gapps-patcher:latest
EOF

echo "Loaded and verified Rebroid images from ${input_dir}"
