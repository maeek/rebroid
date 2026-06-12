export const shellQuote = (value: string) =>
  `'${value.replaceAll("'", "'\\''")}'`;

export const buildPmInstallCommand = (apkPath: string) =>
  [
    `apk_path=${shellQuote(apkPath)}`,
    'run_with_timeout() {',
    '  timeout_seconds="$1"',
    '  shift',
    '  "$@" &',
    '  pid=$!',
    '  elapsed=0',
    '  while kill -0 "$pid" 2>/dev/null; do',
    '    if [ "$elapsed" -ge "$timeout_seconds" ]; then',
    '      kill "$pid" 2>/dev/null || true',
    '      wait "$pid" 2>/dev/null || true',
    '      echo "pm install timed out after ${timeout_seconds}s" >&2',
    '      return 124',
    '    fi',
    '    sleep 1',
    '    elapsed=$((elapsed + 1))',
    '  done',
    '  wait "$pid"',
    '}',
    'run_streamed_install() {',
    '  pm install -r -t -g -S "$apk_size" - < "$apk_path"',
    '}',
    'echo "Installing APK from staged file: $apk_path"',
    'if run_with_timeout 180 pm install -r -t -g "$apk_path"; then',
    '  exit 0',
    'fi',
    'path_status=$?',
    'echo "pm install from staged file failed with exit code ${path_status}; retrying streamed install" >&2',
    'apk_size=$(wc -c < "$apk_path" | tr -d " ")',
    'if [ -z "$apk_size" ] || [ "$apk_size" -le 0 ]; then',
    '  echo "staged APK is empty or unreadable: $apk_path" >&2',
    '  exit 1',
    'fi',
    'run_with_timeout 180 run_streamed_install',
  ].join('\n');

export const buildLaunchPackageCommand = (packageName: string) =>
  [
    `package_name=${shellQuote(packageName)}`,
    'monkey -p "$package_name" -c android.intent.category.LAUNCHER 1',
  ].join('\n');

export const resolveInstalledPackageName = ({
  packagesBefore,
  packagesAfter,
  existingPackageName,
}: {
  packagesBefore: string[];
  packagesAfter: string[];
  existingPackageName: string | null;
}) => {
  if (existingPackageName && packagesAfter.includes(existingPackageName)) {
    return existingPackageName;
  }

  const before = new Set(packagesBefore);
  const newlyInstalled = packagesAfter.filter(
    (packageName) => !before.has(packageName),
  );
  if (newlyInstalled.length === 1) {
    return newlyInstalled[0];
  }

  if (newlyInstalled.length > 1) {
    return newlyInstalled.sort()[0];
  }

  return packagesAfter.length === 1 ? packagesAfter[0] : null;
};
