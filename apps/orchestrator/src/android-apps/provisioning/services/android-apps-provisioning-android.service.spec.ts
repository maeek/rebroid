import { parseAndroidBootReadiness } from './android-apps-provisioning-android.service';

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
