import { Logger } from '@nestjs/common';
import { AndroidApplication } from '../../android-application.entity';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import { AndroidAppLifecycleJobKind } from '../../lifecycle/entities/android-app-lifecycle-job.entity';
import { AndroidAppsRuntimeActivationService } from './android-apps-runtime-activation.service';
import { AndroidAppsRuntimeConfigurationService } from './android-apps-runtime-configuration.service';

const reservation = {
  id: 'start-job',
  applicationId: 'app',
  kind: AndroidAppLifecycleJobKind.Start,
};

describe('AndroidAppsRuntimeActivationService', () => {
  const setup = (exists: boolean, failFirstStart = true) => {
    const error = new Error('Network or container not found');
    const startContainer = jest.fn().mockResolvedValue(undefined);
    if (failFirstStart) startContainer.mockRejectedValueOnce(error);
    const createApplicationContainer = jest
      .fn()
      .mockResolvedValue({ id: 'replacement' });
    const createRuntimeBoundary = jest.fn();
    const updateProgress = jest.fn().mockResolvedValue(true);
    const readAndroidRendering = jest.fn().mockResolvedValue({
      mode: 'host',
      renderDevice: '/dev/dri/renderD128',
    });
    const config = {
      devices: ['/dev/binder'],
      optionalDevices: ['/dev/ashmem:/dev/ashmem:rwm'],
      cgroupnsMode: 'private',
    } as never;
    const lifecycle = {
      startContainer,
      getContainerRuntimeState: jest.fn().mockResolvedValue({ exists }),
      inspectContainer: jest.fn(),
      removeContainer: jest.fn(),
    };
    const android = {
      shouldPrepareRemoteAccess: jest.fn().mockReturnValue(false),
      waitForAndroidBoot: jest.fn().mockResolvedValue(undefined),
      prepareNetworkAttachment: jest
        .fn()
        .mockResolvedValue({ networkName: 'app-network' }),
      prepareRemoteAccess: jest.fn().mockResolvedValue(undefined),
    };
    const tracker = { ensureActive: jest.fn() };
    const network = {
      attachRuntimeSupport: jest.fn(),
      createRuntimeBoundary,
      startWithPolicy: jest.fn(
        (_app: AndroidApplication, start: () => Promise<void>) => start(),
      ),
    };
    const service = new AndroidAppsRuntimeActivationService(
      config,
      lifecycle as never,
      { createApplicationContainer } as never,
      { imageExists: jest.fn().mockResolvedValue(true) } as never,
      { engineSummary: jest.fn().mockResolvedValue({}) } as never,
      android as never,
      network as never,
      { updateProgress } as never,
      tracker as never,
      { append: jest.fn() } as never,
      new AndroidAppsRuntimeConfigurationService(
        config,
        { readAndroidRendering } as never,
        lifecycle as never,
        { remove: jest.fn() } as never,
      ),
    );
    const app = Object.assign(new AndroidApplication(), {
      id: 'app',
      containerId: 'old',
      networkName: 'app-network',
      volumeName: 'saved-profile',
      profileMode: ApplicationProfileMode.Persistent,
    });
    return {
      app,
      service,
      android,
      network,
      tracker,
      error,
      startContainer,
      createApplicationContainer,
      createRuntimeBoundary,
      updateProgress,
      lifecycle,
      readAndroidRendering,
    };
  };

  function deferred<T = void>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    return { promise, resolve, reject };
  }

  async function flush() {
    for (let turn = 0; turn < 30; turn += 1) await Promise.resolve();
  }

  it('overlaps attachment and boot only after guarded startup and waits for both before ADB', async () => {
    const { app, service, android, network } = setup(true, false);
    const policy = deferred();
    const boot = deferred();
    const attachment = deferred<{ networkName: string }>();
    android.shouldPrepareRemoteAccess.mockReturnValue(true);
    network.startWithPolicy.mockImplementation(async (_app, start) => {
      await start();
      await policy.promise;
    });
    android.waitForAndroidBoot.mockReturnValue(boot.promise);
    android.prepareNetworkAttachment.mockReturnValue(attachment.promise);
    const activation = service.activate(app, reservation, 'start');
    await flush();
    expect(android.waitForAndroidBoot).not.toHaveBeenCalled();
    expect(android.prepareNetworkAttachment).not.toHaveBeenCalled();
    policy.resolve();
    await flush();
    expect(android.waitForAndroidBoot).toHaveBeenCalledWith(
      app,
      reservation.id,
    );
    expect(android.prepareNetworkAttachment).toHaveBeenCalledWith(
      app,
      reservation.id,
    );
    boot.resolve();
    await flush();
    expect(android.prepareRemoteAccess).not.toHaveBeenCalled();
    const prepared = { networkName: app.networkName };
    attachment.resolve(prepared);
    await activation;
    expect(android.prepareRemoteAccess).toHaveBeenCalledWith(
      app,
      reservation.id,
      prepared,
      expect.any(Number),
    );
  });

  it('timestamps boot failure before the admitted attachment drains', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    try {
      const { app, service, android } = setup(true, false);
      android.shouldPrepareRemoteAccess.mockReturnValue(true);
      const attachment = deferred<{ networkName: string }>();
      android.waitForAndroidBoot.mockRejectedValue(
        new Error('guest unavailable'),
      );
      android.prepareNetworkAttachment.mockReturnValue(attachment.promise);
      const activation = service.activate(app, reservation, 'start');
      const failure = expect(activation).rejects.toThrow('guest unavailable');
      await flush();
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'android_boot_observation_settled',
          reservationId: reservation.id,
          containerId: app.containerId,
          outcome: 'rejected',
          settledAt: expect.any(String),
          elapsedMs: expect.any(Number),
        }),
      );
      expect(android.prepareRemoteAccess).not.toHaveBeenCalled();
      attachment.resolve({ networkName: app.networkName });
      await failure;
    } finally {
      log.mockRestore();
    }
  });

  it('drains an admitted attachment after boot failure before releasing activation', async () => {
    const { app, service, android } = setup(true, false);
    android.shouldPrepareRemoteAccess.mockReturnValue(true);
    const attachment = deferred<{ networkName: string }>();
    android.waitForAndroidBoot.mockRejectedValue(new Error('boot failed'));
    android.prepareNetworkAttachment.mockReturnValue(attachment.promise);
    let settled = false;
    const activation = service.activate(app, reservation, 'start');
    void activation.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await flush();
    expect(settled).toBe(false);
    attachment.resolve({ networkName: app.networkName });
    await expect(activation).rejects.toThrow('boot failed');
    expect(android.prepareRemoteAccess).not.toHaveBeenCalled();
  });

  it('drains boot after a permanent attachment failure and never starts remote access', async () => {
    const { app, service, android } = setup(true, false);
    android.shouldPrepareRemoteAccess.mockReturnValue(true);
    const boot = deferred();
    android.waitForAndroidBoot.mockReturnValue(boot.promise);
    android.prepareNetworkAttachment.mockRejectedValue(
      new Error('attachment failed'),
    );
    let settled = false;
    const activation = service.activate(app, reservation, 'start');
    void activation.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await flush();
    expect(settled).toBe(false);
    boot.resolve();
    await expect(activation).rejects.toThrow('attachment failed');
    expect(android.prepareRemoteAccess).not.toHaveBeenCalled();
  });

  it('drains attachment on cancellation and never starts remote access', async () => {
    const { app, service, android, tracker } = setup(true, false);
    android.shouldPrepareRemoteAccess.mockReturnValue(true);
    const attachment = deferred<{ networkName: string }>();
    android.prepareNetworkAttachment.mockReturnValue(attachment.promise);
    const activation = service.activate(app, reservation, 'start');
    await flush();
    expect(android.prepareNetworkAttachment).toHaveBeenCalledTimes(1);
    tracker.ensureActive.mockImplementation(() => {
      throw new Error('cancelled');
    });
    attachment.resolve({ networkName: app.networkName });
    await expect(activation).rejects.toThrow('cancelled');
    expect(android.prepareRemoteAccess).not.toHaveBeenCalled();
  });

  it('does not admit boot or attachment after the reservation is superseded', async () => {
    const { app, service, android, updateProgress } = setup(true, false);
    android.shouldPrepareRemoteAccess.mockReturnValue(true);
    updateProgress.mockImplementation(
      async (_reservation, patch) => patch.lifecycleStage !== 'android_booting',
    );
    await expect(service.activate(app, reservation, 'start')).rejects.toThrow(
      'no longer reserved',
    );
    expect(android.waitForAndroidBoot).not.toHaveBeenCalled();
    expect(android.prepareNetworkAttachment).not.toHaveBeenCalled();
  });

  it('applies the saved render device and replaces legacy GPU arguments on creation', async () => {
    const { app, service, createApplicationContainer, updateProgress } = setup(
      true,
      false,
    );
    Object.assign(app, {
      containerId: null,
      containerImage: 'redroid/redroid:16.0.0-latest',
      runtimeKind: 'redroid',
      containerArgs:
        'androidboot.redroid_gpu_mode=guest ro.boot.redroid_gpu_node=/dev/dri/renderD129 ro.boot.redroid_gpu_mode=guest ro.secure=0',
    });
    await service.activate(app, reservation, 'provision');

    expect(createApplicationContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        containerArgs: [
          'androidboot.redroid_gpu_mode=host',
          'androidboot.redroid_gpu_node=/dev/dri/renderD128',
          'ro.secure=0',
        ],
        devices: ['/dev/binder', '/dev/dri/renderD128:/dev/dri/renderD128:rwm'],
        optionalDevices: ['/dev/ashmem:/dev/ashmem:rwm'],
      }),
    );
    expect(updateProgress).toHaveBeenCalledWith(
      reservation,
      expect.objectContaining({
        containerId: 'replacement',
        appliedRendering: {
          containerId: 'replacement',
          mode: 'host',
          renderDevice: '/dev/dri/renderD128',
        },
      }),
    );
  });

  it('replaces a stopped host GPU runtime when returning to software and keeps its profile', async () => {
    const {
      app,
      service,
      lifecycle,
      readAndroidRendering,
      createApplicationContainer,
    } = setup(true, false);
    Object.assign(app, {
      containerImage: 'redroid/redroid:16.0.0-latest',
      runtimeKind: 'redroid',
      containerArgs: 'androidboot.redroid_gpu_mode=guest ro.secure=0',
    });
    readAndroidRendering.mockResolvedValue({
      mode: 'software',
      renderDevice: '/dev/dri/renderD128',
    });
    lifecycle.inspectContainer.mockResolvedValue({
      Config: {
        Cmd: [
          'androidboot.redroid_gpu_mode=host',
          'androidboot.redroid_gpu_node=/dev/dri/renderD128',
        ],
      },
      HostConfig: {
        CgroupnsMode: 'private',
        Devices: [
          {
            PathOnHost: '/dev/dri/renderD128',
            PathInContainer: '/dev/dri/renderD128',
            CgroupPermissions: 'rwm',
          },
        ],
      },
      State: { Running: false },
    });
    await service.activate(app, reservation, 'start');

    expect(lifecycle.removeContainer).toHaveBeenCalledWith('old', {
      applicationId: 'app',
      force: false,
      removeVolumes: false,
    });
    expect(createApplicationContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        volumeName: 'saved-profile',
        persistentData: true,
        containerArgs: ['androidboot.redroid_gpu_mode=guest', 'ro.secure=0'],
        devices: ['/dev/binder'],
      }),
    );
    expect(app.appliedRendering).toEqual({
      containerId: 'replacement',
      mode: 'software',
      renderDevice: null,
    });
  });

  it('reuses a matching runtime when optional ashmem was mapped', async () => {
    const { app, service, lifecycle, createApplicationContainer } = setup(
      true,
      false,
    );
    Object.assign(app, { runtimeKind: 'redroid', containerArgs: null });
    lifecycle.inspectContainer.mockResolvedValue({
      Config: {
        Cmd: [
          'androidboot.redroid_gpu_mode=host',
          'androidboot.redroid_gpu_node=/dev/dri/renderD128',
        ],
      },
      HostConfig: {
        CgroupnsMode: 'private',
        Devices: ['/dev/binder', '/dev/ashmem', '/dev/dri/renderD128'].map(
          (path) => ({
            PathOnHost: path,
            PathInContainer: path,
            CgroupPermissions: 'rwm',
          }),
        ),
      },
      State: { Running: false },
    });
    await service.activate(app, reservation, 'start');
    expect(createApplicationContainer).not.toHaveBeenCalled();
    expect(lifecycle.startContainer).toHaveBeenCalledWith('old');
  });

  it('does not apply the platform GPU policy to a generic runtime', async () => {
    const { app, service, readAndroidRendering, createApplicationContainer } =
      setup(true, false);
    Object.assign(app, {
      containerId: null,
      runtimeKind: 'generic',
      containerArgs: 'sleep infinity',
    });
    await service.activate(app, reservation, 'provision');
    expect(readAndroidRendering).not.toHaveBeenCalled();
    expect(createApplicationContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        containerArgs: 'sleep infinity',
        devices: ['/dev/binder'],
      }),
    );
  });

  it('reports a required GPU mapping error returned during Start', async () => {
    const { app, service, lifecycle } = setup(true, false);
    Object.assign(app, { containerId: null, runtimeKind: 'redroid' });
    lifecycle.startContainer.mockRejectedValueOnce(
      new Error('stat /dev/dri/renderD128: no such file'),
    );
    await expect(
      service.activate(app, reservation, 'provision'),
    ).rejects.toThrow(
      'Docker could not map GPU render device /dev/dri/renderD128',
    );
  });

  it('uses one saved setting for comparison and replacement even if the setting changes', async () => {
    const {
      app,
      service,
      lifecycle,
      readAndroidRendering,
      createApplicationContainer,
    } = setup(true, false);
    app.runtimeKind = 'redroid';
    lifecycle.inspectContainer.mockImplementation(async () => {
      readAndroidRendering.mockResolvedValue({
        mode: 'software',
        renderDevice: null,
      });
      return {
        Config: { Cmd: ['androidboot.redroid_gpu_mode=guest'] },
        HostConfig: { CgroupnsMode: 'private', Devices: [] },
        State: { Running: false },
      };
    });
    await service.activate(app, reservation, 'start');
    expect(createApplicationContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        devices: ['/dev/binder', '/dev/dri/renderD128:/dev/dri/renderD128:rwm'],
      }),
    );
    expect(app.appliedRendering).toEqual({
      containerId: 'replacement',
      mode: 'host',
      renderDevice: '/dev/dri/renderD128',
    });
  });

  it('starts a replacement with the same persistent profile if the old container disappears', async () => {
    const {
      app,
      service,
      startContainer,
      createApplicationContainer,
      createRuntimeBoundary,
      updateProgress,
    } = setup(false);
    await service.activate(app, reservation, 'start');

    expect(updateProgress).toHaveBeenCalledWith(
      reservation,
      expect.objectContaining({ containerId: null }),
    );
    expect(createRuntimeBoundary).toHaveBeenCalledTimes(1);
    expect(createApplicationContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        volumeName: 'saved-profile',
        persistentData: true,
      }),
    );
    expect(startContainer.mock.calls).toEqual([['old'], ['replacement']]);
    expect(app.containerId).toBe('replacement');
  });

  it('preserves the start failure if the app container still exists', async () => {
    const { app, service, error, createApplicationContainer } = setup(true);
    await expect(service.activate(app, reservation, 'start')).rejects.toBe(
      error,
    );
    expect(createApplicationContainer).not.toHaveBeenCalled();
  });
});
