#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_REPOSITORY:?SOURCE_REPOSITORY is required}"
: "${SOURCE_REVISION:?SOURCE_REVISION is required}"
: "${GAPPS_ANDROID_VERSION:?GAPPS_ANDROID_VERSION is required}"

rm -rf /work/source /output/package.zip
mkdir -p /work/source /output
git -C /work/source init --initial-branch=main
git -C /work/source remote add origin "${SOURCE_REPOSITORY}"
git -C /work/source fetch --depth 1 origin "${SOURCE_REVISION}"
git -C /work/source checkout --detach FETCH_HEAD

if [[ "${GAPPS_ANDROID_VERSION}" == 15 || "${GAPPS_ANDROID_VERSION}" == 16 ]]; then
  # These x86-64 packages still ship Android 13 Play Services, which needs GSF's legacy provider.
  gsf_revision=e8c101ba0e90b705ec1428da8359401d9d8c7c18
  gsf_sha256=9fb9989adcef635b24604bc8f667698b5265ce585f54022f37b30cdd668e5def
  gsf_path=common/proprietary/system_ext/priv-app/GoogleServicesFramework/GoogleServicesFramework.apk
  echo "Using MindTheGapps Google Services Framework from ${gsf_revision} for x86-64 compatibility."
  curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
    --max-time 60 --max-filesize 10485760 \
    --output "/work/source/${gsf_path}" \
    "https://gitlab.com/MindTheGapps/vendor_gapps/-/raw/${gsf_revision}/${gsf_path}"
  printf '%s  %s\n' "${gsf_sha256}" "/work/source/${gsf_path}" | sha256sum -c -
fi

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
