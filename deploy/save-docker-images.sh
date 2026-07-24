#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "${script_dir}/.." && pwd)"
output_dir="${1:-${script_dir}/docker-images}"
platform="${PLATFORM:-linux/amd64}"

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
container_engine_name="$(basename -- "${container_engine}")"

build_image() {
  local image_name="$1"
  local context_dir="$2"
  local dockerfile_path="$3"
  shift 3
  local -a format_args=()

  if [[ "${container_engine_name}" == "podman" ]]; then
    format_args=(--format docker)
  fi

  echo "Building ${image_name} for ${platform}"
  "${container_engine}" build \
    --platform "${platform}" \
    "${format_args[@]}" \
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
  "localhost/rebroid/edge:local" \
  "${repo_dir}" \
  "${repo_dir}/deploy/edge/Dockerfile"

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

build_image \
  "rebroid/gapps-patcher:latest" \
  "${repo_dir}/apps/gapps-patcher" \
  "${repo_dir}/apps/gapps-patcher/Dockerfile"

"${container_engine}" image inspect \
  localhost/rebroid/orchestrator:local \
  localhost/rebroid/web:local \
  localhost/rebroid/edge:local \
  localhost/rebroid/display-sidecar:local \
  localhost/rebroid/ocr-sidecar:local \
  localhost/rebroid/firewall-agent:local \
  rebroid/gapps-patcher:latest \
  --format '{{.RepoTags}} {{.Os}}/{{.Architecture}}'

mkdir -p "${output_dir}"

while read -r image_name archive_name; do
  [[ -n "${image_name}" ]] || continue

  if ! "${container_engine}" image inspect "${image_name}" >/dev/null 2>&1; then
    echo "Missing image: ${image_name}" >&2
    exit 1
  fi

  archive_path="${output_dir}/${archive_name}"
  echo "Saving ${image_name} -> ${archive_path}"
  "${container_engine}" image save --output "${archive_path}" "${image_name}"
done <<'EOF'
localhost/rebroid/web:local rebroid-web-local.tar
localhost/rebroid/edge:local rebroid-edge-local.tar
localhost/rebroid/orchestrator:local rebroid-orchestrator-local.tar
localhost/rebroid/display-sidecar:local rebroid-display-sidecar-local.tar
localhost/rebroid/ocr-sidecar:local rebroid-ocr-sidecar-local.tar
localhost/rebroid/firewall-agent:local rebroid-firewall-agent-local.tar
rebroid/gapps-patcher:latest rebroid-gapps-patcher-latest.tar
EOF

echo "Saved Rebroid images to ${output_dir}"
