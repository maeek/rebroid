import {
  buildLaunchPackageCommand,
  buildPmInstallCommand,
  resolveInstalledPackageName,
  shellQuote,
} from './android-apps-apk-provisioning.utils';

describe('android APK provisioning utils', () => {
  it('quotes shell values safely', () => {
    expect(shellQuote("/data/local/tmp/app's.apk")).toBe(
      "'/data/local/tmp/app'\\''s.apk'",
    );
  });

  it('builds the staged APK install command with streamed fallback', () => {
    const command = buildPmInstallCommand("/data/local/tmp/app's.apk");

    expect(command).toContain("apk_path='/data/local/tmp/app'\\''s.apk'");
    expect(command).toContain('pm install -r -t -g "$apk_path"');
    expect(command).toContain(
      'pm install -r -t -g -S "$apk_size" - < "$apk_path"',
    );
    expect(command).toContain('run_with_timeout 180');
  });

  it('builds the launch command for a package name', () => {
    expect(buildLaunchPackageCommand('com.example.app')).toBe(
      [
        "package_name='com.example.app'",
        'monkey -p "$package_name" -c android.intent.category.LAUNCHER 1',
      ].join('\n'),
    );
  });

  it('prefers an existing package name when Android reports it installed', () => {
    expect(
      resolveInstalledPackageName({
        packagesBefore: ['com.before'],
        packagesAfter: ['com.before', 'com.recorded'],
        existingPackageName: 'com.recorded',
      }),
    ).toBe('com.recorded');
  });

  it('uses the only newly installed package when no existing package matches', () => {
    expect(
      resolveInstalledPackageName({
        packagesBefore: ['com.before'],
        packagesAfter: ['com.before', 'com.new'],
        existingPackageName: 'com.missing',
      }),
    ).toBe('com.new');
  });

  it('uses a stable alphabetical package when multiple packages appear', () => {
    expect(
      resolveInstalledPackageName({
        packagesBefore: ['com.before'],
        packagesAfter: ['com.zeta', 'com.before', 'com.alpha'],
        existingPackageName: null,
      }),
    ).toBe('com.alpha');
  });

  it('returns null when package detection is ambiguous', () => {
    expect(
      resolveInstalledPackageName({
        packagesBefore: ['com.one', 'com.two'],
        packagesAfter: ['com.one', 'com.two'],
        existingPackageName: null,
      }),
    ).toBeNull();
  });
});
