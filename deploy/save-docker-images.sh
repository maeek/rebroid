#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "${script_dir}/.." && pwd)"
output_dir="${1:-${script_dir}/docker-images}"
platform="${PLATFORM:-linux/amd64}"

container_engine="${CONTAINER_ENGINE_BIN:-${PODMAN_BIN:-}}"
if [[ -z "${container_engine}" ]]; then
  container_engine="$(command -v docker || command -v podman)" || {
    echo "Docker or Podman is required." >&2
    exit 1
  }
fi
container_engine_name="$(basename -- "${container_engine}")"
images=()

build_image() {
  local image_name="$1"
  local context_dir="$2"
  local dockerfile_path="$3"
  shift 3

  if [[ "${container_engine_name}" == "podman" ]]; then
    set -- --format docker "$@"
  fi

  echo "Building ${image_name} for ${platform}"
  "${container_engine}" build \
    --platform "${platform}" \
    -t "${image_name}" \
    -f "${dockerfile_path}" \
    "$@" \
    "${context_dir}"
  images+=("${image_name}")
}

build_image \
  "localhost/rebroid/orchestrator:local" \
  "${repo_dir}" \
  "${repo_dir}/apps/orchestrator/Dockerfile"

build_image \
  "localhost/rebroid/web:local" \
  "${repo_dir}" \
  "${repo_dir}/apps/web/Dockerfile" \
  --build-arg "NEXT_PROXY_CLIENT_MAX_BODY_SIZE=${NEXT_PROXY_CLIENT_MAX_BODY_SIZE:-512mb}"

build_image \
  "localhost/rebroid/edge:local" \
  "${repo_dir}/deploy/edge" \
  "${repo_dir}/deploy/edge/Dockerfile"

build_image \
  "localhost/rebroid/display-sidecar:local" \
  "${repo_dir}" \
  "${repo_dir}/apps/display-sidecar/Dockerfile"

build_image \
  "localhost/rebroid/ocr-sidecar:local" \
  "${repo_dir}/apps/ocr-sidecar" \
  "${repo_dir}/apps/ocr-sidecar/Dockerfile"

build_image \
  "localhost/rebroid/firewall-agent:local" \
  "${repo_dir}" \
  "${repo_dir}/apps/firewall-agent/Dockerfile"

build_image \
  "localhost/rebroid/gapps-patcher:latest" \
  "${repo_dir}/apps/gapps-patcher" \
  "${repo_dir}/apps/gapps-patcher/Dockerfile"

"${container_engine}" image inspect "${images[@]}" --format '{{.RepoTags}} {{.Os}}/{{.Architecture}}'

mkdir -p "${output_dir}"
staging_dir="$(mktemp -d "${output_dir}/.rebroid-export.XXXXXX")"
trap 'rm -f -- "${staging_dir}/image.tar"; rmdir -- "${staging_dir}"' EXIT

for image_name in "${images[@]}"; do
  tag="${image_name#localhost/rebroid/}"
  archive_path="${output_dir}/rebroid-${tag/:/-}.tar"
  echo "Saving ${image_name} -> ${archive_path}"
  "${container_engine}" image save --output "${staging_dir}/image.tar" "${image_name}"
  mv -f -- "${staging_dir}/image.tar" "${archive_path}"
done

echo "Saved Rebroid images to ${output_dir}"
