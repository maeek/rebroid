#!/usr/bin/env bash

set -euo pipefail

export DOCKER_HOST=unix:///var/folders/dq/lzsfy1_14ql4hh76s153f_lc0000gn/T/podman/machine-api.sock

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "${script_dir}/.." && pwd)"
output_dir="${1:-${script_dir}/docker-images}"
podman_bin="${PODMAN_BIN:-/opt/podman/bin/podman}"
platform="${PLATFORM:-linux/amd64}"

build_image() {
  local image_name="$1"
  local context_dir="$2"
  local dockerfile_path="$3"
  shift 3

  echo "Building ${image_name} for ${platform}"
  "${podman_bin}" build \
    --platform "${platform}" \
    --format docker \
    -t "${image_name}" \
    -f "${dockerfile_path}" \
    "$@" \
    "${context_dir}"
}

build_image \
  "localhost/rebroid/orchestrator:local" \
  "${repo_dir}" \
  "${repo_dir}/apps/orchestrator/Dockerfile"

build_image \
  "localhost/rebroid/web:local" \
  "${repo_dir}" \
  "${repo_dir}/apps/web/Dockerfile" \
  --build-arg "NEXT_PROXY_CLIENT_MAX_BODY_SIZE=${NEXT_PROXY_CLIENT_MAX_BODY_SIZE:-512mb}" \
  --build-arg "DISPLAY_SIDECAR_INTERNAL_BASE_URL=${DISPLAY_SIDECAR_INTERNAL_BASE_URL:-http://rebroid-display-sidecar:8000}"

build_image \
  "localhost/rebroid/display-sidecar:local" \
  "${repo_dir}" \
  "${repo_dir}/apps/display-sidecar/Dockerfile"

build_image \
  "localhost/rebroid/ocr-sidecar:local" \
  "${repo_dir}" \
  "${repo_dir}/apps/ocr-sidecar/Dockerfile"

build_image \
  "localhost/rebroid/firewall-agent:local" \
  "${repo_dir}" \
  "${repo_dir}/apps/firewall-agent/Dockerfile"

"${podman_bin}" image inspect \
  localhost/rebroid/orchestrator:local \
  localhost/rebroid/web:local \
  localhost/rebroid/display-sidecar:local \
  localhost/rebroid/ocr-sidecar:local \
  localhost/rebroid/firewall-agent:local \
  --format '{{.RepoTags}} {{.Os}}/{{.Architecture}}'

mkdir -p "${output_dir}"

while read -r image_name archive_name; do
  [[ -n "${image_name}" ]] || continue

  if ! "${podman_bin}" image exists "${image_name}"; then
    echo "Missing image: ${image_name}" >&2
    exit 1
  fi

  archive_path="${output_dir}/${archive_name}"
  echo "Saving ${image_name} -> ${archive_path}"
  "${podman_bin}" image save --output "${archive_path}" "${image_name}"
done <<'EOF'
localhost/rebroid/web:local rebroid-web-local.tar
localhost/rebroid/orchestrator:local rebroid-orchestrator-local.tar
localhost/rebroid/display-sidecar:local rebroid-display-sidecar-local.tar
localhost/rebroid/ocr-sidecar:local rebroid-ocr-sidecar-local.tar
localhost/rebroid/firewall-agent:local rebroid-firewall-agent-local.tar
EOF

echo "Saved Rebroid images to ${output_dir}"
