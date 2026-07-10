#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
engine="${CONTAINER_ENGINE:-docker}"
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

"${engine}" build -q -t rebroid/gapps-patcher:fixture "${repo_root}/apps/gapps-patcher"
"${engine}" run --rm \
  --env SOURCE_REPOSITORY=file:///fixture \
  --env SOURCE_REVISION="${revision}" \
  --volume "${temporary}/repository:/fixture:ro" \
  --volume "${temporary}/output:/output" \
  rebroid/gapps-patcher:fixture

test -s "${temporary}/output/package.zip"
