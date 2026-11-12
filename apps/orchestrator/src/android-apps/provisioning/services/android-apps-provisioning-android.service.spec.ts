import { spawnSync } from 'node:child_process';
import {
  androidBootDiagnosticSummary,
  parseAndroidBootReadiness,
  truncateDiagnosticText,
} from '../utils/android-apps-android-provisioning.utils';
import { AndroidAppsProvisioningAndroidService } from './android-apps-provisioning-android.service';

jest.mock('node:timers/promises', () => ({
  setTimeout: (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
}));

describe('Android startup probe scheduling', () => {
  const app = {
    id: 'app',
    containerId: 'container',
    networkName: 'network',
    adbPort: 5555,
  } as AndroidApplication;
  const connected = {
    configured: true,
    connected: true,
    message: 'ready',
    error: null,
  };

  function setup() {
    const exec = {
      execInContainerWithOutput: jest.fn(),
      execInContainer: jest.fn().mockResolvedValue(undefined),
    };
    const lifecycle = {
      getContainerRuntimeState: jest
        .fn()
        .mockResolvedValue({ exists: true, running: true }),
    };
    const engine = { isTransientDockerTransportError: jest.fn() };
    const sidecar = {
      adbTargetGeneration: 1,
      ensureSidecarOnNetwork: jest.fn(),
      connectAdb: jest.fn().mockResolvedValue(connected),
    };
    sidecar.ensureSidecarOnNetwork.mockImplementation(async () => ({
      ...connected,
      sidecarGeneration: sidecar.adbTargetGeneration,
    }));
    const viewer = {
      observeProvisioningAdbTarget: jest.fn().mockResolvedValue({
        adbHost: '172.18.0.2',
        containerStartedAt: '2026-11-12T22:52:50Z',
      }),
      rememberProvisionedAdb: jest.fn(),
    };
    const android = new AndroidAppsProvisioningAndroidService(
      exec as unknown as DockerContainerExecPort,
      lifecycle as unknown as DockerContainerLifecyclePort,
      engine as unknown as DockerEnginePort,
      sidecar as unknown as DockerSidecarPort,
      { append: jest.fn() } as unknown as AndroidAppsLogService,
      {
        ensureActive: jest.fn(),
      } as unknown as AndroidAppsProvisioningTrackerService,
      viewer as unknown as AndroidAppsViewerNetworkService,
      new ConfigService({
        app: { redroid: { bootTimeoutSeconds: 15, adbTimeoutSeconds: 10 } },
      }),
    );
    return { android, exec, lifecycle, engine, sidecar, viewer };
  }

  beforeEach(() => jest.useFakeTimers({ now: 0 }));
  afterEach(() => jest.useRealTimers());

  it('backs off unchanged Android properties while checking container liveness every second', async () => {
    const { android, exec, lifecycle } = setup();
    const probeTimes: number[] = [];
    exec.execInContainerWithOutput.mockImplementation(async () => {
      probeTimes.push(Date.now());
      return {
        stdout: Date.now() >= 4_000 ? 'dev.bootcomplete=1' : '',
        stderr: '',
      };
    });
    const boot = android.waitForAndroidBoot(app);
    await jest.advanceTimersByTimeAsync(6_000);
    await expect(boot).resolves.toBeUndefined();
    expect(probeTimes).toEqual([0, 1_000, 3_000, 6_000]);
    expect(lifecycle.getContainerRuntimeState).toHaveBeenCalledTimes(7);
  });

  it('reuses setup facts on a retry and refreshes both after an observed sidecar restart', async () => {
    const { android, lifecycle, sidecar, viewer } = setup();
    sidecar.connectAdb
      .mockResolvedValueOnce({ ...connected, connected: false })
      .mockImplementationOnce(async () => {
        sidecar.adbTargetGeneration += 1;
        return connected;
      });
    const remoteAccess = android.prepareRemoteAccess(app);
    await jest.advanceTimersByTimeAsync(2_000);
    await expect(remoteAccess).resolves.toBeUndefined();
    expect(sidecar.connectAdb).toHaveBeenCalledTimes(3);
    expect(lifecycle.getContainerRuntimeState).toHaveBeenCalledTimes(3);
    expect(sidecar.ensureSidecarOnNetwork).toHaveBeenCalledTimes(2);
    expect(viewer.observeProvisioningAdbTarget).toHaveBeenCalledTimes(2);
    expect(viewer.rememberProvisionedAdb).toHaveBeenCalledTimes(1);
    expect(viewer.rememberProvisionedAdb).toHaveBeenCalledWith(app, {
      adbHost: '172.18.0.2',
      containerStartedAt: '2026-11-12T22:52:50Z',
      sidecarGeneration: 2,
      target: connected,
    });
  });

  it('fails TCP property setup before stopping or starting adbd if setprop fails', async () => {
    const { android, exec } = setup();
    await android.prepareRemoteAccess(app);
    const [, command] = exec.execInContainer.mock.calls[0]!;
    const shell = spawnSync(
      'sh',
      [
        '-c',
        [
          'getprop() { if [ "$1" = init.svc.adbd ]; then printf running; fi; }',
          'setprop() { return 13; }',
          'stop() { printf stopped; }',
          'start() { printf started; }',
          command.at(-1),
        ].join('\n'),
      ],
      { encoding: 'utf8' },
    );
    expect(shell.status).toBe(13);
    expect(shell.stdout).toBe('');
  });

  it('waits for an admitted sidecar attachment to settle before retrying', async () => {
    const { android, lifecycle, engine, sidecar } = setup();
    lifecycle.getContainerRuntimeState.mockRejectedValueOnce(
      new Error('reset'),
    );
    engine.isTransientDockerTransportError.mockReturnValue(true);
    sidecar.ensureSidecarOnNetwork.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ ...connected, sidecarGeneration: 1 }),
            2_000,
          ),
        ),
    );
    const remoteAccess = android.prepareRemoteAccess(app);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(sidecar.ensureSidecarOnNetwork).toHaveBeenCalledTimes(1);
    expect(sidecar.connectAdb).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(2_000);
    await expect(remoteAccess).resolves.toBeUndefined();
    expect(sidecar.ensureSidecarOnNetwork).toHaveBeenCalledTimes(2);
    expect(sidecar.connectAdb).toHaveBeenCalledTimes(1);
  });

  it('uses the time spent configuring the guest against the readiness deadline', async () => {
    const { android, exec, sidecar, viewer } = setup();
    exec.execInContainer.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 10_001)),
    );
    const result = expect(android.prepareRemoteAccess(app)).rejects.toThrow(
      'Timed out preparing Android remote access after 10s',
    );
    await jest.advanceTimersByTimeAsync(10_001);
    await result;
    expect(sidecar.ensureSidecarOnNetwork).not.toHaveBeenCalled();
    expect(viewer.rememberProvisionedAdb).not.toHaveBeenCalled();
  });
});

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
import { ConfigService } from '@nestjs/config';
import type { DockerContainerExecPort } from '../../../docker/contracts/docker-container-exec.port';
import type { DockerContainerLifecyclePort } from '../../../docker/contracts/docker-container-lifecycle.port';
import type { DockerEnginePort } from '../../../docker/contracts/docker-engine.port';
import type { DockerSidecarPort } from '../../../docker/contracts/docker-sidecar.port';
import type { AndroidApplication } from '../../android-application.entity';
import type { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import type { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import type { AndroidAppsViewerNetworkService } from '../../viewer/services/android-apps-viewer-network.service';
