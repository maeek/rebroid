#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_REPOSITORY:?SOURCE_REPOSITORY is required}"
: "${SOURCE_REVISION:?SOURCE_REVISION is required}"

rm -rf /work/source /output/package.zip
mkdir -p /work/source /output
git -C /work/source init --initial-branch=main
git -C /work/source remote add origin "${SOURCE_REPOSITORY}"
git -C /work/source fetch --depth 1 origin "${SOURCE_REVISION}"
git -C /work/source checkout --detach FETCH_HEAD
make -C /work/source gapps_x86_64

package_path="$(find /work/source/out -maxdepth 2 -type f -name '*x86_64*.zip' -print | sort | tail -n 1)"
if [[ -z "${package_path}" ]]; then
  echo "MindTheGapps build did not produce an x86_64 package." >&2
  exit 1
fi
if (( $(stat -c '%s' "${package_path}") > 2147483648 )); then
  echo "Generated GApps package exceeds 2 GB." >&2
  exit 1
fi

cp "${package_path}" /output/package.zip
