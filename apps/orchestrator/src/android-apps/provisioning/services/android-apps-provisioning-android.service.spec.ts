import { spawnSync } from 'node:child_process';
import { Logger } from '@nestjs/common';
import type { DockerOperationOptions } from '../../../docker/contracts/docker-operation-options';
import { ContainerCommandFailedException } from '../../../docker/docker.types';
import { AndroidAppsTcpAdbService } from '../../common/services/android-apps-tcp-adb.service';
import { OperationDeadlineExceededError } from '../../../common/operation-deadline';
import {
  androidBootDiagnosticSummary,
  parseAndroidBootReadiness,
  truncateDiagnosticText,
} from '../utils/android-apps-android-provisioning.utils';
import { AndroidAppsProvisioningAndroidService } from './android-apps-provisioning-android.service';

jest.mock('node:timers/promises', () => ({
  setTimeout: (
    ms: number,
    _value?: unknown,
    options?: { signal?: AbortSignal },
  ) =>
    new Promise<void>((resolve, reject) => {
      const signal = options?.signal;
      if (signal?.aborted) return reject(signal.reason);
      const cleanup = () => signal?.removeEventListener('abort', abort);
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, ms);
      const abort = () => {
        clearTimeout(timer);
        cleanup();
        reject(signal?.reason);
      };
      signal?.addEventListener('abort', abort, { once: true });
    }),
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

  function setup(collectBootEvents = false) {
    const exec = {
      execInContainerWithOutput: jest
        .fn()
        .mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
      execInContainer: jest.fn().mockResolvedValue(undefined),
    };
    const lifecycle = {
      getContainerRuntimeState: jest
        .fn()
        .mockResolvedValue({ exists: true, running: true }),
    };
    const engine = {
      isTransientDockerTransportError: jest.fn(
        (error: unknown) => (error as { code?: string })?.code === 'ECONNRESET',
      ),
    };
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
    const tracker = new AndroidAppsProvisioningTrackerService();
    const logs = { append: jest.fn().mockResolvedValue(undefined) };
    const android = new AndroidAppsProvisioningAndroidService(
      exec as unknown as DockerContainerExecPort,
      lifecycle as unknown as DockerContainerLifecyclePort,
      engine as unknown as DockerEnginePort,
      sidecar as unknown as DockerSidecarPort,
      logs as unknown as AndroidAppsLogService,
      tracker,
      viewer as unknown as AndroidAppsViewerNetworkService,
      new ConfigService({
        app: {
          redroid: {
            bootTimeoutSeconds: 15,
            adbTimeoutSeconds: 10,
            collectBootEvents,
          },
        },
      }),
      new AndroidAppsTcpAdbService(
        exec as unknown as DockerContainerExecPort,
        engine as unknown as DockerEnginePort,
      ),
    );
    return { android, exec, lifecycle, engine, sidecar, viewer, tracker, logs };
  }

  beforeEach(() => jest.useFakeTimers({ now: 0 }));
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('filters one Android property snapshot before returning it from Docker', async () => {
    const { android, exec } = setup();
    exec.execInContainerWithOutput.mockImplementation(
      async (_id, command: string[]) => {
        const shell = spawnSync(
          'sh',
          [
            '-c',
            [
              "getprop() { [ \"$#\" -eq 0 ] || return 1; printf '%s\\n' '[dev.bootcomplete]: [1]' '[init.svc.adbd]: [running]' '[devXbootcomplete]: [0]' '[unrelated]: [private]'; }",
              command[2],
            ].join('\n'),
          ],
          { encoding: 'utf8' },
        );
        expect(shell.status).toBe(0);
        expect(shell.stdout).toBe(
          'dev.bootcomplete=1\ninit.svc.adbd=running\n',
        );
        return { stdout: shell.stdout, stderr: shell.stderr };
      },
    );
    await android.waitForAndroidBoot(app);
    expect(exec.execInContainerWithOutput).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    'keeps guest boot events optional and outside readiness (enabled: %s)',
    async (collectBootEvents) => {
      const { android, exec, lifecycle } = setup(collectBootEvents);
      const log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => {});
      jest.setSystemTime(11_000);
      lifecycle.getContainerRuntimeState.mockResolvedValue({
        exists: true,
        running: true,
        startedAt: new Date(10_000).toISOString(),
      });
      const remote = jest
        .spyOn(android, 'prepareRemoteAccess')
        .mockResolvedValue(undefined);
      exec.execInContainerWithOutput
        .mockResolvedValueOnce({ stdout: 'dev.bootcomplete=0', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'dev.bootcomplete=1', stderr: '' });
      let finishEvents!: () => void;
      const pending = new Promise<void>((resolve) => {
        finishEvents = resolve;
      });
      exec.execInContainerWithOutput.mockImplementationOnce(async () => {
        await pending;
        return {
          stdout: [
            '9.500000 123 123 I boot_progress_ams_ready: 32000',
            '11.900000 123 123 I boot_progress_ams_ready: 34400',
            '11.950000 123 123 I unrelated: 34450',
            '12.900000 123 123 I boot_progress_ams_ready: 35400',
          ].join('\n'),
        };
      });

      const runtime = android.prepareRuntime(app, 'reservation', async () => {});
      await jest.advanceTimersByTimeAsync(1_000);
      await runtime;
      expect(remote).toHaveBeenCalledTimes(1);
      expect(lifecycle.getContainerRuntimeState).toHaveBeenCalledTimes(2);
      expect(log).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: 'android_boot_guest_events' }),
      );
      await jest.advanceTimersByTimeAsync(1);
      expect(exec.execInContainerWithOutput).toHaveBeenCalledTimes(
        collectBootEvents ? 3 : 2,
      );
      finishEvents();
      await jest.advanceTimersByTimeAsync(0);
      if (collectBootEvents) {
        expect(exec.execInContainerWithOutput).toHaveBeenLastCalledWith(
          app.containerId,
          expect.arrayContaining(['events', '-T', '10.000', '-m', '32']),
          expect.objectContaining({
            deadline: expect.objectContaining({ timeoutMs: 2_000 }),
            signal: expect.any(AbortSignal),
          }),
        );
        expect(log).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'android_boot_guest_events',
            reservationId: 'reservation',
            outcome: 'collected',
            lastNotReadySample: expect.objectContaining({ sequence: 1 }),
            readySample: expect.objectContaining({ sequence: 2 }),
            events: [
              {
                tag: 'boot_progress_ams_ready',
                offsetFromContainerStartMs: 1_900,
              },
            ],
          }),
        );
      }
    },
  );

  it.each(['boot', 'attachment'] as const)(
    'drains the other preparation when %s fails and skips remote access',
    async (failed) => {
      const { android } = setup();
      const log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => {});
      const boot = jest.spyOn(android, 'waitForAndroidBoot');
      const attachment = jest.spyOn(android, 'prepareNetworkAttachment');
      const remote = jest.spyOn(android, 'prepareRemoteAccess');
      const beforeRemote = jest.fn();
      let finish!: () => void;
      const pending = new Promise<void>((resolve) => {
        finish = resolve;
      });
      if (failed === 'boot') {
        boot.mockRejectedValue(new Error('boot failed'));
        attachment.mockReturnValue(pending.then(() => undefined as never));
      } else {
        boot.mockReturnValue(pending.then(() => undefined));
        attachment.mockRejectedValue(new Error('attachment failed'));
      }
      let settled = false;
      const result = android
        .prepareRuntime(app, 'reservation', beforeRemote)
        .catch((error: unknown) => {
          settled = true;
          throw error;
        });
      await jest.advanceTimersByTimeAsync(0);
      expect(settled).toBe(false);
      if (failed === 'boot') {
        expect(log).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'android_boot_observation_settled',
            outcome: 'rejected',
          }),
        );
      }
      finish();
      await expect(result).rejects.toThrow(`${failed} failed`);
      expect(beforeRemote).not.toHaveBeenCalled();
      expect(remote).not.toHaveBeenCalled();
    },
  );

  it('admits both boot and attachment before preparing remote access', async () => {
    const { android, sidecar, exec } = setup();
    exec.execInContainerWithOutput.mockResolvedValue({
      stdout: 'dev.bootcomplete=1',
      stderr: '',
      exitCode: 0,
    });
    let finishAttachment!: () => void;
    const attached = new Promise<void>((resolve) => {
      finishAttachment = resolve;
    });
    sidecar.ensureSidecarOnNetwork.mockImplementationOnce(async () => {
      await attached;
      return { ...connected, sidecarGeneration: sidecar.adbTargetGeneration };
    });
    const beforeRemote = jest.fn().mockResolvedValue(undefined);
    const preparation = android.prepareRuntime(
      app,
      'reservation',
      beforeRemote,
    );
    await jest.advanceTimersByTimeAsync(0);
    expect(sidecar.ensureSidecarOnNetwork).toHaveBeenCalledTimes(1);
    expect(exec.execInContainerWithOutput).toHaveBeenCalledTimes(1);
    expect(beforeRemote).not.toHaveBeenCalled();
    finishAttachment();
    await preparation;
    expect(beforeRemote).toHaveBeenCalledTimes(1);
    expect(sidecar.connectAdb).toHaveBeenCalledTimes(1);
  });

  it('drains an admitted attachment after cancellation and skips remote access', async () => {
    const { android, tracker, sidecar } = setup();
    jest.spyOn(android, 'waitForAndroidBoot').mockResolvedValue(undefined);
    let finishAttachment!: () => void;
    const pending = new Promise<void>((resolve) => {
      finishAttachment = resolve;
    });
    const attachment = jest
      .spyOn(android, 'prepareNetworkAttachment')
      .mockImplementation(async () => {
        await pending;
        throw new Error('Attachment finished after cancellation');
      });
    const beforeRemote = jest.fn();
    const preparation = android.prepareRuntime(
      app,
      'reservation',
      beforeRemote,
    );
    let settled = false;
    const failure = expect(
      preparation.catch((error: unknown) => {
        settled = true;
        throw error;
      }),
    ).rejects.toThrow(/cancelled/i);
    await jest.advanceTimersByTimeAsync(0);
    expect(attachment).toHaveBeenCalledTimes(1);
    tracker.cancel(app.id);
    await jest.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    finishAttachment();
    await failure;
    expect(beforeRemote).not.toHaveBeenCalled();
    expect(sidecar.connectAdb).not.toHaveBeenCalled();
  });

  it('backs off unchanged Android properties while checking container liveness every second', async () => {
    const diagnosticLog = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});
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
    const observations = diagnosticLog.mock.calls
      .map(
        ([entry]) =>
          entry as { event: string; properties: { outcome: string } },
      )
      .filter((entry) => entry.event === 'android_boot_probe');
    expect(observations).toHaveLength(7);
    expect(
      observations.filter(
        (entry) => entry.properties.outcome === 'skipped_backoff',
      ),
    ).toHaveLength(3);
  });

  it('separates admission and Docker work while preserving concurrent probe settlement times', async () => {
    const diagnosticLog = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});
    const { android, exec, lifecycle, logs } = setup();
    const wait = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));
    exec.execInContainerWithOutput.mockImplementation(
      async (
        _id: string,
        _command: string[],
        options: DockerOperationOptions,
      ) => {
        await wait(2_000);
        options.onDispatched?.();
        await wait(1_000);
        return {
          stdout: 'dev.bootcomplete=1',
          stderr: 'not included in timing logs',
        };
      },
    );
    lifecycle.getContainerRuntimeState.mockImplementation(
      async (_id: string, options: DockerOperationOptions) => {
        await wait(100);
        options.onDispatched?.();
        await wait(5_900);
        return { exists: true, running: true };
      },
    );

    const boot = android.waitForAndroidBoot(app, 'reservation');
    await jest.advanceTimersByTimeAsync(6_000);
    await expect(boot).resolves.toBeUndefined();
    expect(diagnosticLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'android_boot_probe',
        reservationId: 'reservation',
        applicationId: app.id,
        containerId: app.containerId,
        bootObservationId: expect.any(String),
        sequence: 1,
        elapsedMs: 6_000,
        observationMs: 6_000,
        waitSincePreviousObservationMs: 0,
        propertyReady: true,
        runtimeRunning: true,
        properties: expect.objectContaining({
          outcome: 'fulfilled',
          dispatched: true,
          queueMs: 2_000,
          executionMs: 1_000,
          totalMs: 3_000,
          settledAfterMs: 3_000,
        }),
        runtime: expect.objectContaining({
          outcome: 'fulfilled',
          dispatched: true,
          queueMs: 100,
          executionMs: 5_900,
          totalMs: 6_000,
          settledAfterMs: 6_000,
        }),
      }),
    );
    expect(JSON.stringify(diagnosticLog.mock.calls)).not.toContain(
      'not included',
    );
    expect(exec.execInContainerWithOutput).toHaveBeenCalledTimes(1);
    expect(lifecycle.getContainerRuntimeState).toHaveBeenCalledTimes(1);
    expect(logs.append).toHaveBeenCalledTimes(1);
  });

  function unavailableGuestShell(
    stderr = 'exec /bin/sh: no such file or directory',
    exitCode = 255,
  ) {
    return new ContainerCommandFailedException({
      message: `Container command failed with exit code ${exitCode}: ${stderr}`,
      command: ['sh', '-lc', 'getprop'],
      exitCode,
      stdout: '',
      stderr,
    });
  }

  it('replays an initially unavailable guest shell through not-ready properties to readiness', async () => {
    const diagnosticLog = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});
    const { android, exec, lifecycle, logs } = setup();
    const failure = unavailableGuestShell();
    exec.execInContainerWithOutput
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ stdout: 'dev.bootcomplete=0', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'dev.bootcomplete=1', stderr: '' });

    const boot = android.waitForAndroidBoot(app);
    await jest.advanceTimersByTimeAsync(4_000);
    expect(logs.append).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1_000);
    await expect(boot).resolves.toBeUndefined();
    expect(exec.execInContainerWithOutput).toHaveBeenCalledTimes(6);
    expect(lifecycle.getContainerRuntimeState).toHaveBeenCalledTimes(6);
    expect(
      diagnosticLog.mock.calls.filter(
        ([entry]) =>
          (entry as { event: string }).event !== 'android_boot_probe',
      ),
    ).toEqual([
      [
        {
          event: 'android_guest_shell_unavailable',
          applicationId: app.id,
          containerId: app.containerId,
          observedAt: new Date(0).toISOString(),
        },
      ],
      [
        {
          event: 'android_guest_shell_available',
          applicationId: app.id,
          containerId: app.containerId,
          observedAt: new Date(4_000).toISOString(),
          elapsedMs: 4_000,
          unavailableObservations: 4,
        },
      ],
    ]);
    expect(diagnosticLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'android_boot_probe',
        sequence: 1,
        initialGuestShellUnavailable: true,
        propertyReady: null,
        properties: expect.objectContaining({ outcome: 'rejected' }),
      }),
    );
    expect(logs.append).toHaveBeenCalledWith(
      app.id,
      'Android boot completed',
      expect.anything(),
    );
  });

  it('bounds an unavailable initial guest shell by the overall boot budget', async () => {
    const { android, exec, lifecycle, logs } = setup();
    exec.execInContainerWithOutput.mockRejectedValue(unavailableGuestShell());
    const getContainerLogs = jest.fn().mockResolvedValue('guest not available');
    Object.assign(lifecycle, { getContainerLogs });

    const failed = expect(android.waitForAndroidBoot(app)).rejects.toThrow(
      'Timed out waiting for Android to finish booting after 15s',
    );
    await jest.advanceTimersByTimeAsync(15_000);
    await failed;
    expect(lifecycle.getContainerRuntimeState).toHaveBeenCalledTimes(15);
    // Fifteen boot observations plus the separately bounded diagnostic command.
    expect(exec.execInContainerWithOutput).toHaveBeenCalledTimes(16);
    expect(getContainerLogs).toHaveBeenCalledTimes(1);
    expect(logs.append).toHaveBeenCalledWith(
      app.id,
      'Android boot diagnostics',
      expect.anything(),
    );
  });

  it.each([
    unavailableGuestShell('exec /bin/sh: permission denied'),
    unavailableGuestShell('exec /bin/sh: no such file or directory', 127),
    unavailableGuestShell('getprop: permission denied'),
    new Error('exec /bin/sh: no such file or directory'),
  ])('does not retry unrelated guest command failure: %s', async (failure) => {
    const { android, exec, lifecycle } = setup();
    exec.execInContainerWithOutput.mockRejectedValue(failure);
    await expect(android.waitForAndroidBoot(app)).rejects.toBe(failure);
    expect(exec.execInContainerWithOutput).toHaveBeenCalledTimes(1);
    expect(lifecycle.getContainerRuntimeState).toHaveBeenCalledTimes(1);
  });

  it('does not treat guest shell disappearance after a successful probe as initial startup', async () => {
    const { android, exec } = setup();
    const failure = unavailableGuestShell();
    exec.execInContainerWithOutput
      .mockResolvedValueOnce({ stdout: 'dev.bootcomplete=0', stderr: '' })
      .mockRejectedValueOnce(failure);
    const failed = expect(android.waitForAndroidBoot(app)).rejects.toBe(
      failure,
    );
    await jest.advanceTimersByTimeAsync(1_000);
    await failed;
    expect(exec.execInContainerWithOutput).toHaveBeenCalledTimes(2);
  });

  it.each([
    { exists: false, running: false, expected: 'no longer exists' },
    { exists: true, running: false, oomKilled: true, expected: 'OOM-killed' },
  ])(
    'stops guest-shell retries when the runtime is terminal ($expected)',
    async (state) => {
      const { android, exec, lifecycle } = setup();
      exec.execInContainerWithOutput.mockRejectedValue(unavailableGuestShell());
      lifecycle.getContainerRuntimeState
        .mockResolvedValueOnce({ exists: true, running: true })
        .mockResolvedValueOnce(state);
      const failed = expect(android.waitForAndroidBoot(app)).rejects.toThrow(
        state.expected,
      );
      await jest.advanceTimersByTimeAsync(1_000);
      await failed;
      expect(exec.execInContainerWithOutput).toHaveBeenCalledTimes(2);
    },
  );

  it('cancels while waiting for the initial guest shell without admitting another probe', async () => {
    const { android, exec, tracker, logs } = setup();
    exec.execInContainerWithOutput.mockRejectedValue(unavailableGuestShell());
    const failed = expect(android.waitForAndroidBoot(app)).rejects.toThrow(
      'cancelled',
    );
    await jest.advanceTimersByTimeAsync(0);
    tracker.cancel(app.id);
    await failed;
    await jest.advanceTimersByTimeAsync(1_000);
    expect(exec.execInContainerWithOutput).toHaveBeenCalledTimes(1);
    expect(logs.append).not.toHaveBeenCalled();
  });

  it('recovers an uncertain runtime read without trusting ready properties alone', async () => {
    const { android, exec, lifecycle, logs } = setup();
    exec.execInContainerWithOutput.mockResolvedValue({
      stdout: 'dev.bootcomplete=1',
      stderr: '',
      exitCode: 0,
    });
    lifecycle.getContainerRuntimeState.mockRejectedValueOnce(
      Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
    );
    const boot = android.waitForAndroidBoot(app);
    await jest.advanceTimersByTimeAsync(0);
    expect(logs.append).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1_000);
    await boot;
    expect(lifecycle.getContainerRuntimeState).toHaveBeenCalledTimes(2);
    expect(logs.append).toHaveBeenCalledWith(
      app.id,
      'Android boot completed',
      expect.anything(),
    );
  });

  it.each([
    { exists: false, running: false, expected: 'no longer exists' },
    { exists: true, running: false, oomKilled: true, expected: 'OOM-killed' },
  ])(
    'fails terminal runtime observations even with ready properties ($expected)',
    async (state) => {
      const { android, exec, lifecycle } = setup();
      exec.execInContainerWithOutput.mockResolvedValue({
        stdout: 'dev.bootcomplete=1',
        stderr: '',
        exitCode: 0,
      });
      lifecycle.getContainerRuntimeState.mockResolvedValue(state);
      await expect(android.waitForAndroidBoot(app)).rejects.toThrow(
        state.expected,
      );
      expect(lifecycle.getContainerRuntimeState).toHaveBeenCalledTimes(1);
    },
  );

  it('fails permanent inspection errors without retrying or diagnostics', async () => {
    const { android, lifecycle, logs } = setup();
    lifecycle.getContainerRuntimeState.mockRejectedValue(
      Object.assign(new Error('forbidden'), { statusCode: 403 }),
    );
    await expect(android.waitForAndroidBoot(app)).rejects.toThrow('forbidden');
    expect(lifecycle.getContainerRuntimeState).toHaveBeenCalledTimes(1);
    expect(logs.append).not.toHaveBeenCalled();
  });

  it('bounds repeated transient observation failures', async () => {
    const { android, lifecycle } = setup();
    lifecycle.getContainerRuntimeState.mockRejectedValue(
      Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
    );
    const failed = expect(android.waitForAndroidBoot(app)).rejects.toThrow(
      'reset',
    );
    await jest.advanceTimersByTimeAsync(3_000);
    await failed;
    expect(lifecycle.getContainerRuntimeState).toHaveBeenCalledTimes(3);
  });

  it('withdraws a pending boot observation on cancellation without reporting readiness', async () => {
    const { android, lifecycle, tracker, logs } = setup();
    lifecycle.getContainerRuntimeState.mockImplementation(
      (_id: string, options: { signal: AbortSignal }) =>
        new Promise((_, reject) => {
          options.signal.addEventListener(
            'abort',
            () => reject(options.signal.reason),
            { once: true },
          );
        }),
    );
    const failed = expect(android.waitForAndroidBoot(app)).rejects.toThrow(
      'cancelled',
    );
    await jest.advanceTimersByTimeAsync(0);
    tracker.cancel(app.id);
    await failed;
    expect(logs.append).not.toHaveBeenCalled();
  });

  it('shares a bounded diagnostic allowance and skips log reads once it is spent', async () => {
    const { android, exec, lifecycle, logs } = setup();
    const getContainerLogs = jest.fn();
    Object.assign(lifecycle, { getContainerLogs });
    const remaining: number[] = [];
    exec.execInContainerWithOutput.mockImplementation(
      (_id, _command, options) => {
        remaining.push(options.deadline.remainingMs());
        return new Promise((_, reject) =>
          setTimeout(
            () => reject(new OperationDeadlineExceededError()),
            options.deadline.remainingMs(),
          ),
        );
      },
    );
    const failed = expect(android.waitForAndroidBoot(app)).rejects.toThrow(
      'Timed out waiting for Android to finish booting after 15s',
    );
    await jest.advanceTimersByTimeAsync(20_000);
    await failed;
    expect(remaining).toEqual([10_000, 4_000, 5_000]);
    expect(getContainerLogs).not.toHaveBeenCalled();
    expect(logs.append).toHaveBeenCalledWith(
      app.id,
      'Android boot diagnostics',
      expect.anything(),
    );
  });

  it('uses a monotonic boot budget across wall clock changes', async () => {
    const { android, exec } = setup();
    exec.execInContainerWithOutput.mockImplementation(async () => {
      jest.setSystemTime(Date.now() + 60_000);
      return {
        stdout: performance.now() >= 1_000 ? 'dev.bootcomplete=1' : '',
        stderr: '',
        exitCode: 0,
      };
    });
    const boot = android.waitForAndroidBoot(app);
    await jest.advanceTimersByTimeAsync(1_000);
    await expect(boot).resolves.toBeUndefined();
    expect(exec.execInContainerWithOutput).toHaveBeenCalledTimes(2);
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
    expect(sidecar.connectAdb).toHaveBeenLastCalledWith(
      '172.18.0.2',
      app.adbPort,
      expect.anything(),
      expect.any(AbortSignal),
      'transport',
    );
    expect(lifecycle.getContainerRuntimeState).toHaveBeenCalledTimes(3);
    expect(sidecar.ensureSidecarOnNetwork).toHaveBeenCalledTimes(2);
    expect(viewer.observeProvisioningAdbTarget).toHaveBeenCalledTimes(2);
    expect(viewer.rememberProvisionedAdb).toHaveBeenCalledTimes(1);
    expect(viewer.rememberProvisionedAdb).toHaveBeenCalledWith(app, {
      adbHost: '172.18.0.2',
      containerStartedAt: '2026-11-12T22:52:50Z',
      sidecarGeneration: 2,
      target: connected,
      purpose: 'transport',
    });
  });

  it('prepares the interactive display before launching an attached APK', async () => {
    const { android, sidecar, viewer } = setup();
    const withApk = { ...app, apkFilePath: '/uploads/app.apk' };

    await android.prepareRemoteAccess(withApk);

    expect(sidecar.connectAdb).toHaveBeenCalledWith(
      '172.18.0.2',
      withApk.adbPort,
      expect.anything(),
      expect.any(AbortSignal),
      'interactive',
    );
    expect(viewer.rememberProvisionedAdb).toHaveBeenCalledWith(
      withApk,
      expect.objectContaining({ purpose: 'interactive', target: connected }),
    );
  });

  it('reuses a recent boot-overlapped attachment with fresh runtime and target observations', async () => {
    const { android, sidecar, lifecycle, viewer } = setup();
    const attachment = await android.prepareNetworkAttachment(
      app,
      'reservation',
    );
    await android.prepareRemoteAccess(app, 'reservation', attachment);
    expect(sidecar.ensureSidecarOnNetwork).toHaveBeenCalledTimes(1);
    expect(lifecycle.getContainerRuntimeState).toHaveBeenCalledTimes(1);
    expect(viewer.observeProvisioningAdbTarget).toHaveBeenCalledTimes(1);
    expect(sidecar.connectAdb).toHaveBeenCalledTimes(1);
  });

  it('retries a transient attachment failure after boot through normal ADB readiness', async () => {
    const { android, sidecar, engine } = setup();
    sidecar.ensureSidecarOnNetwork.mockRejectedValueOnce(
      new Error('transient disconnect'),
    );
    engine.isTransientDockerTransportError.mockReturnValue(true);
    const attachment = await android.prepareNetworkAttachment(
      app,
      'reservation',
    );
    expect(attachment).toBeUndefined();
    await android.prepareRemoteAccess(app, 'reservation', attachment);
    expect(sidecar.ensureSidecarOnNetwork).toHaveBeenCalledTimes(2);
    expect(sidecar.connectAdb).toHaveBeenCalledTimes(1);
  });

  it.each(['reservation', 'container', 'network', 'generation', 'expiry'])(
    'rechecks an overlapped attachment after %s changes',
    async (changed) => {
      const { android, sidecar } = setup();
      const attachment = await android.prepareNetworkAttachment(
        app,
        'reservation',
      );
      if (changed === 'generation') sidecar.adbTargetGeneration += 1;
      if (changed === 'expiry') await jest.advanceTimersByTimeAsync(3_001);
      await android.prepareRemoteAccess(
        {
          ...app,
          containerId:
            changed === 'container' ? 'replacement' : app.containerId,
          networkName:
            changed === 'network' ? 'replacement-network' : app.networkName,
        },
        changed === 'reservation' ? 'new-reservation' : 'reservation',
        attachment,
      );
      expect(sidecar.ensureSidecarOnNetwork).toHaveBeenCalledTimes(2);
    },
  );

  it('fails TCP property setup before stopping or starting adbd if setprop fails', async () => {
    const { android, exec } = setup();
    await android.prepareRemoteAccess(app);
    const [, command] = exec.execInContainerWithOutput.mock.calls[0]!;
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

  it('charges attachment work remaining after boot against the remote access deadline', async () => {
    const { android, exec, sidecar } = setup();
    const bootCompletedAt = performance.now();
    await jest.advanceTimersByTimeAsync(10_001);
    await expect(
      android.prepareRemoteAccess(
        app,
        'reservation',
        undefined,
        bootCompletedAt,
      ),
    ).rejects.toThrow('Timed out preparing Android remote access after 10s');
    expect(exec.execInContainerWithOutput).not.toHaveBeenCalled();
    expect(sidecar.connectAdb).not.toHaveBeenCalled();
  });

  it('uses the time spent configuring the guest against the readiness deadline', async () => {
    const { android, exec, sidecar, viewer } = setup();
    exec.execInContainerWithOutput.mockImplementationOnce(
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
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import type { AndroidAppsViewerNetworkService } from '../../viewer/services/android-apps-viewer-network.service';
