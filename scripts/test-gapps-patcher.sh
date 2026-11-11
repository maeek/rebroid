#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
engine="${CONTAINER_ENGINE:-docker}"
image="rebroid/gapps-patcher:fixture"
temporary="$(mktemp -d)"
trap 'rm -rf "${temporary}"' EXIT

cp -R "${repo_root}/apps/gapps-patcher/fixtures/vendor_gapps" "${temporary}/repository"
mkdir -m 0777 -p "${temporary}/output"
git -C "${temporary}/repository" init --quiet --initial-branch=main
git -C "${temporary}/repository" config user.email fixture@rebroid.local
git -C "${temporary}/repository" config user.name Rebroid
git -C "${temporary}/repository" add .
git -C "${temporary}/repository" commit --quiet -m fixture
revision="$(git -C "${temporary}/repository" rev-parse HEAD)"

"${engine}" build -q -t "${image}" "${repo_root}/apps/gapps-patcher"
test "$("${engine}" image inspect --format '{{ index .Config.Labels "com.rebroid.gapps-patcher.version" }}' "${image}")" = 1
worker_user="$("${engine}" image inspect --format '{{ .Config.User }}' "${image}")"
[[ "${worker_user}" =~ ^[1-9][0-9]*(:[1-9][0-9]*)?$ ]]
"${engine}" run --rm \
  --network none --cap-drop ALL --security-opt no-new-privileges \
  --env SOURCE_REPOSITORY=file:///fixture \
  --env SOURCE_REVISION="${revision}" \
  --volume "${temporary}/repository:/fixture:ro" \
  --volume "${temporary}/output:/output" \
  "${image}"

test -s "${temporary}/output/package.zip"
"${engine}" run --rm --network none --entrypoint sh \
  --volume "${temporary}/output:/output:ro" "${image}" -ec '
    unzip -tq /output/package.zip
    for member in "$@"; do
      unzip -p /output/package.zip "$member" >/dev/null
    done
  ' sh \
  system/product/priv-app/GmsCore/GmsCore.apk \
  system/product/priv-app/Phonesky/Phonesky.apk \
  system/etc/permissions/privapp-permissions-google.xml
