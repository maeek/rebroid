import {
  androidBootDiagnosticSummary,
  parseAndroidBootReadiness,
  truncateDiagnosticText,
} from '../utils/android-apps-android-provisioning.utils';

describe('AndroidAppsProvisioningAndroidService boot readiness', () => {
  it('ignores sys.boot_completed as a readiness shortcut', () => {
    expect(
      parseAndroidBootReadiness(
        [
          'sys.boot_completed=1',
          'dev.bootcomplete=',
          'init.svc.bootanim=running',
        ].join('\n'),
      ),
    ).toMatchObject({ ready: false });
  });

  it('accepts Redroid service readiness when boot properties are not set', () => {
    expect(
      parseAndroidBootReadiness(
        [
          'dev.bootcomplete=',
          'service.bootanim.exit=',
          'init.svc.bootanim=stopped',
          'init.svc.zygote=running',
          'init.svc.zygote64=',
          'init.svc.surfaceflinger=running',
          'init.svc.servicemanager=running',
          'init.svc.hwservicemanager=running',
          'init.svc.adbd=running',
        ].join('\n'),
      ),
    ).toMatchObject({ ready: true });
  });

  it('keeps waiting when core Android services are not ready', () => {
    const readiness = parseAndroidBootReadiness(
      [
        'dev.bootcomplete=',
        'service.bootanim.exit=',
        'init.svc.bootanim=stopped',
        'init.svc.zygote=running',
        'init.svc.surfaceflinger=stopped',
        'init.svc.servicemanager=running',
        'init.svc.hwservicemanager=running',
      ].join('\n'),
    );

    expect(readiness.ready).toBe(false);
    expect(readiness.probe).toContain('init.svc.surfaceflinger=stopped');
  });
});

describe('Android boot diagnostics utils', () => {
  it('summarizes binder and permission failures', () => {
    expect(
      androidBootDiagnosticSummary(
        'cannot access /dev/binder: no such file\npermission denied',
      ),
    ).toBe(
      'binder devices may be missing inside the runtime container; container permissions or security profile may be blocking Redroid',
    );
  });

  it('summarizes ashmem failures with memfd hint', () => {
    expect(
      androidBootDiagnosticSummary(
        "couldn't create ashmem region\nro.boot.use_memfd=true",
      ),
    ).toContain(
      'Android display stack is still trying to use ashmem even though memfd is enabled',
    );
  });

  it('truncates long diagnostics with omitted character count', () => {
    expect(truncateDiagnosticText('abcdef', 3)).toBe(
      'abc\n... truncated 3 chars',
    );
  });
});
