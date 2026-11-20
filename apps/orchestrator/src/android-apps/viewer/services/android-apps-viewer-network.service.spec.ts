import { OperationDeadline } from '../../../common/operation-deadline';
import type { AndroidAppsTcpAdbService } from '../../common/services/android-apps-tcp-adb.service';
import type { DockerContainerLifecyclePort } from '../../../docker/contracts/docker-container-lifecycle.port';
import type { DockerNetworkRuntimePort } from '../../../docker/contracts/docker-network-runtime.port';
import type { DockerSidecarPort } from '../../../docker/contracts/docker-sidecar.port';
import type { FeatureFlagsService } from '../../../feature-flags/feature-flags.service';
import type { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import type { AndroidApplication } from '../../android-application.entity';
import type { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsPolicyGate } from '../../common/services/android-apps-policy-gate.service';
import type { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import type { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import type { AndroidAppsDisplaySidecarService } from './android-apps-display-sidecar.service';
import { AndroidAppsSidecarAdbService } from './android-apps-sidecar-adb.service';
import { AndroidAppsViewerService } from './android-apps-viewer.service';
import {
  AndroidAppsViewerNetworkService,
  ViewerRuntimeChangedError,
} from './android-apps-viewer-network.service';

const connected = {
  configured: true,
  connected: true,
  error: null,
  message: 'ready',
};

const runtime = {
  id: 'app-1',
  containerId: 'container-1',
  containerName: 'app-1',
  containerImage: 'fixture',
  networkName: 'network-1',
  adbPort: 5555,
  lastStartedAt: new Date(1000),
  status: AndroidApplicationStatus.Running,
  networkPolicyEnabled: true,
  networkPolicyAllowCidrs: '["192.0.2.0/24"]',
  networkPolicyRevision: 2,
} as AndroidApplication;

const adbHost = '172.18.0.2';
const containerStartedAt = '2026-11-12T22:52:50.818Z';

function inspectRuntime(startedAt = containerStartedAt, ip = adbHost) {
  return {
    Id: runtime.containerId,
    State: { Running: true, StartedAt: startedAt },
    NetworkSettings: { Networks: { [runtime.networkName]: { IPAddress: ip } } },
  };
}

function setup(current = runtime) {
  const sidecar = {
    adbTargetGeneration: 1,
    ensureSidecarOnNetwork: jest.fn(),
    connectAdb: jest.fn().mockResolvedValue(connected),
    detachSidecarFromNetwork: jest.fn().mockResolvedValue(undefined),
  };
  sidecar.ensureSidecarOnNetwork.mockImplementation(async () => ({
    ...connected,
    sidecarGeneration: sidecar.adbTargetGeneration,
  }));
  const networks = {
    getContainerIpOnNetwork: jest.fn().mockResolvedValue(adbHost),
  };
  const lifecycle = {
    inspectContainer: jest.fn().mockResolvedValue(inspectRuntime()),
  };
  const policy = {
    apply: jest.fn(),
    remove: jest.fn(),
    refreshViewerPolicy: jest
      .fn()
      .mockResolvedValue({ status: 'applied', message: 'Applied' }),
  };
  const writer = {
    recordViewerNetworkPolicy: jest.fn().mockResolvedValue(true),
  };
  const queries = { getStored: jest.fn().mockResolvedValue(current) };
  const gate = new AndroidAppsPolicyGate();
  const tcpAdb = {
    prepare: jest
      .fn()
      .mockResolvedValue({ stdout: 'ready', stderr: '', exitCode: 0 }),
  };
  const features = { assertEnabled: jest.fn() };
  const viewer = new AndroidAppsViewerNetworkService(
    networks as unknown as DockerNetworkRuntimePort,
    sidecar as unknown as DockerSidecarPort,
    tcpAdb as unknown as AndroidAppsTcpAdbService,
    policy as unknown as NetworkPolicyService,
    {
      append: jest.fn().mockResolvedValue(undefined),
    } as unknown as AndroidAppsLogService,
    writer as unknown as AndroidAppsStateWriter,
    queries as unknown as AndroidAppsQueryService,
    gate,
    lifecycle as unknown as DockerContainerLifecyclePort,
    features as unknown as FeatureFlagsService,
  );
  return {
    viewer,
    policy,
    sidecar,
    writer,
    queries,
    gate,
    networks,
    lifecycle,
    tcpAdb,
    features,
  };
}

describe('shared viewer target preparation', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reuses the observed ADB transport across minute captures and revalidates after five minutes', async () => {
    jest.useFakeTimers();
    try {
      const redroid = {
        ...runtime,
        containerImage: 'redroid/redroid:16.0.0-latest',
      };
      const { viewer, sidecar, networks, policy, tcpAdb } = setup(redroid);
      const captureTarget = () =>
        viewer.requireObservedAdbTransport(
          { ...redroid, containerStartedAt },
          adbHost,
          new AbortController().signal,
        );
      const prepared = await captureTarget();
      for (let minute = 1; minute < 5; minute += 1) {
        jest.advanceTimersByTime(60_000);
        await expect(captureTarget()).resolves.toBe(prepared);
      }
      expect(sidecar.ensureSidecarOnNetwork).toHaveBeenCalledTimes(1);
      expect(sidecar.connectAdb).toHaveBeenCalledTimes(1);
      expect(policy.refreshViewerPolicy).toHaveBeenCalledTimes(1);
      expect(tcpAdb.prepare).toHaveBeenCalledTimes(1);
      expect(networks.getContainerIpOnNetwork).not.toHaveBeenCalled();

      jest.advanceTimersByTime(60_000);
      await expect(captureTarget()).resolves.not.toBe(prepared);
      expect(sidecar.connectAdb).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('prepares the observed transport again when runtime, address, policy or sidecar changes', async () => {
    const { viewer, sidecar, networks, policy, queries } = setup();
    const signal = new AbortController().signal;
    const target = { ...runtime, containerStartedAt };
    const initial = await viewer.requireObservedAdbTransport(
      target,
      adbHost,
      signal,
    );
    const restarted = {
      ...target,
      containerStartedAt: '2026-11-12T22:53:50.818Z',
    };
    await expect(
      viewer.requireObservedAdbTransport(restarted, adbHost, signal),
    ).resolves.not.toBe(initial);
    const newHost = '172.18.0.3';
    await expect(
      viewer.requireObservedAdbTransport(restarted, newHost, signal),
    ).resolves.toMatchObject({
      udid: `${newHost}:${runtime.adbPort}`,
    });

    const updated = { ...restarted, networkPolicyRevision: 3 };
    queries.getStored.mockResolvedValue(updated);
    policy.refreshViewerPolicy.mockResolvedValueOnce({
      status: 'failed',
      message: 'policy unavailable',
    });
    await expect(
      viewer.requireObservedAdbTransport(updated, newHost, signal),
    ).rejects.toThrow('policy unavailable');
    expect(sidecar.connectAdb).toHaveBeenCalledTimes(3);
    const afterPolicyUpdate = await viewer.requireObservedAdbTransport(
      updated,
      newHost,
      signal,
    );
    sidecar.adbTargetGeneration += 1;
    await expect(
      viewer.requireObservedAdbTransport(updated, newHost, signal),
    ).resolves.not.toBe(afterPolicyUpdate);
    expect(sidecar.connectAdb).toHaveBeenCalledTimes(5);
    expect(networks.getContainerIpOnNetwork).not.toHaveBeenCalled();
  });

  it('reprepares the observed transport after a failed snapshot request', async () => {
    const { viewer, sidecar, features } = setup();
    const adb = new AndroidAppsSidecarAdbService(
      new ConfigService({
        app: { displaySidecar: { internalBaseUrl: 'http://sidecar.test' } },
      }),
      viewer,
    );
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({ message: 'ADB unavailable' }, { status: 503 }),
      )
      .mockResolvedValueOnce(Response.json({ mimeType: 'image/png' }));
    const snapshot = () =>
      adb.captureSnapshotPng(
        { ...runtime, containerStartedAt },
        adbHost,
        new AbortController().signal,
        1024,
      );
    await expect(snapshot()).rejects.toThrow('ADB unavailable');
    await expect(snapshot()).resolves.toEqual({ mimeType: 'image/png' });
    expect(sidecar.connectAdb).toHaveBeenCalledTimes(2);
    features.assertEnabled.mockImplementationOnce(() => {
      throw new Error('feature.firewall is disabled.');
    });
    await expect(snapshot()).rejects.toThrow('feature.firewall is disabled.');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not let transport-only readiness replace interactive preparation', async () => {
    const { viewer, sidecar } = setup();
    await viewer.requireViewerTarget(runtime, undefined, 'transport');
    await viewer.requireViewerTarget(runtime, undefined, 'transport');
    await viewer.prepareViewerTarget(runtime);

    expect(sidecar.connectAdb.mock.calls).toEqual([
      [adbHost, runtime.adbPort, undefined, undefined, 'transport'],
      [adbHost, runtime.adbPort],
    ]);
  });

  it('reuses an interactive target for an observed read only at the same host and start time', async () => {
    const { viewer, sidecar, policy } = setup();
    const expected = { ...runtime, containerStartedAt };
    const signal = new AbortController().signal;
    const interactive = await viewer.prepareViewerTarget(expected);

    await expect(
      viewer.requireObservedAdbTransport(expected, adbHost, signal),
    ).resolves.toBe(interactive);
    expect(policy.refreshViewerPolicy).toHaveBeenCalledTimes(1);

    const restarted = {
      ...expected,
      containerStartedAt: '2026-11-12T22:53:50.818Z',
    };
    const afterRestart = await viewer.requireObservedAdbTransport(
      restarted,
      adbHost,
      signal,
    );
    expect(afterRestart).not.toBe(interactive);

    const newHost = '172.18.0.3';
    await expect(
      viewer.requireObservedAdbTransport(expected, newHost, signal),
    ).resolves.toMatchObject({ adbHost: newHost });

    await expect(viewer.prepareViewerTarget(expected)).resolves.not.toBe(
      interactive,
    );
    expect(policy.refreshViewerPolicy).toHaveBeenCalledTimes(4);
    expect(sidecar.connectAdb.mock.calls).toEqual([
      [adbHost, runtime.adbPort],
      [adbHost, runtime.adbPort, undefined, undefined, 'transport'],
      [newHost, runtime.adbPort, undefined, undefined, 'transport'],
      [adbHost, runtime.adbPort],
    ]);
  });

  it('reuses interactive provisioning readiness after verifying the live target and applying viewer policy', async () => {
    const { viewer, policy, sidecar, lifecycle } = setup();
    const target = { ...connected, message: 'verified during provisioning' };
    const observed = await viewer.observeProvisioningAdbTarget(runtime);
    viewer.rememberProvisionedAdb(runtime, {
      ...observed,
      sidecarGeneration: sidecar.adbTargetGeneration,
      target,
      purpose: 'interactive',
    });

    await expect(viewer.prepareViewerTarget(runtime)).resolves.toMatchObject({
      udid: `${adbHost}:5555`,
      viewerTarget: target,
    });
    expect(lifecycle.inspectContainer).toHaveBeenCalledTimes(2);
    expect(sidecar.ensureSidecarOnNetwork).toHaveBeenCalledTimes(1);
    expect(policy.refreshViewerPolicy).toHaveBeenCalledWith(runtime);
    expect(sidecar.connectAdb).not.toHaveBeenCalled();
  });

  it('reuses the headless provisioning observation for reads and prepares display for the first viewer', async () => {
    const { viewer, policy, sidecar, networks } = setup();
    const target = { ...connected, message: 'verified during provisioning' };
    viewer.rememberProvisionedAdb(runtime, {
      adbHost,
      containerStartedAt,
      sidecarGeneration: sidecar.adbTargetGeneration,
      target,
      purpose: 'transport',
    });

    await expect(
      viewer.requireViewerTarget(runtime, undefined, 'transport'),
    ).resolves.toMatchObject({ viewerTarget: target });
    expect(sidecar.connectAdb).not.toHaveBeenCalled();

    await expect(viewer.prepareViewerTarget(runtime)).resolves.toMatchObject({
      viewerTarget: connected,
    });
    expect(sidecar.connectAdb).toHaveBeenCalledTimes(1);
    expect(sidecar.connectAdb).toHaveBeenCalledWith(adbHost, runtime.adbPort);
    expect(networks.getContainerIpOnNetwork).not.toHaveBeenCalled();
    expect(policy.refreshViewerPolicy.mock.invocationCallOrder[1]).toBeLessThan(
      sidecar.connectAdb.mock.invocationCallOrder[0]!,
    );
  });

  it('rechecks ADB after a transport read invalidates a provisioning handoff', async () => {
    const { viewer, sidecar } = setup();
    viewer.rememberProvisionedAdb(runtime, {
      adbHost,
      containerStartedAt,
      sidecarGeneration: sidecar.adbTargetGeneration,
      target: connected,
      purpose: 'transport',
    });
    const prepared = await viewer.requireViewerTarget(
      runtime,
      undefined,
      'transport',
    );
    expect(sidecar.connectAdb).not.toHaveBeenCalled();

    viewer.invalidateViewerTarget(prepared);
    await viewer.requireViewerTarget(runtime, undefined, 'transport');

    expect(sidecar.connectAdb).toHaveBeenCalledWith(
      adbHost,
      runtime.adbPort,
      undefined,
      undefined,
      'transport',
    );
  });

  it.each([
    inspectRuntime('2026-11-12T22:52:51.818Z'),
    inspectRuntime(containerStartedAt, '172.18.0.3'),
  ])(
    'reconnects when the Docker start or address changed (%o)',
    async (inspect) => {
      const { viewer, sidecar, lifecycle } = setup();
      const observed = await viewer.observeProvisioningAdbTarget(runtime);
      viewer.rememberProvisionedAdb(runtime, {
        ...observed,
        sidecarGeneration: sidecar.adbTargetGeneration,
        target: connected,
        purpose: 'interactive',
      });
      lifecycle.inspectContainer.mockResolvedValue(inspect);

      await viewer.prepareViewerTarget(runtime);
      expect(sidecar.connectAdb).toHaveBeenCalledWith(
        inspect.NetworkSettings.Networks[runtime.networkName].IPAddress,
        runtime.adbPort,
      );
    },
  );

  it('reconnects when the observed sidecar was replaced', async () => {
    const { viewer, sidecar } = setup();
    viewer.rememberProvisionedAdb(runtime, {
      adbHost,
      containerStartedAt,
      sidecarGeneration: sidecar.adbTargetGeneration,
      target: connected,
      purpose: 'interactive',
    });
    sidecar.adbTargetGeneration += 1;

    await viewer.prepareViewerTarget(runtime);
    expect(sidecar.connectAdb).toHaveBeenCalledWith(adbHost, runtime.adbPort);
  });

  it('discards provisioning readiness after its short handoff window expires', async () => {
    jest.useFakeTimers();
    try {
      const { viewer, sidecar, lifecycle } = setup();
      viewer.rememberProvisionedAdb(runtime, {
        adbHost,
        containerStartedAt,
        sidecarGeneration: sidecar.adbTargetGeneration,
        target: connected,
        purpose: 'interactive',
      });
      jest.advanceTimersByTime(10_000);

      await viewer.prepareViewerTarget(runtime);
      expect(lifecycle.inspectContainer).not.toHaveBeenCalled();
      expect(sidecar.connectAdb).toHaveBeenCalledWith(adbHost, runtime.adbPort);
    } finally {
      jest.useRealTimers();
    }
  });

  it('discards provisioning readiness when the viewer policy revision changed', async () => {
    const updatedRuntime = { ...runtime, networkPolicyRevision: 3 };
    const { viewer, sidecar, policy, lifecycle } = setup(updatedRuntime);
    viewer.rememberProvisionedAdb(runtime, {
      adbHost,
      containerStartedAt,
      sidecarGeneration: sidecar.adbTargetGeneration,
      target: connected,
      purpose: 'interactive',
    });

    await viewer.prepareViewerTarget(updatedRuntime);
    expect(lifecycle.inspectContainer).not.toHaveBeenCalled();
    expect(policy.refreshViewerPolicy).toHaveBeenCalledWith(updatedRuntime);
    expect(sidecar.connectAdb).toHaveBeenCalledWith(adbHost, runtime.adbPort);
  });

  it('uses one network attachment, address read and ADB connect for a Display session and ADB log reads', async () => {
    const { viewer, queries, sidecar, networks } = setup();
    const config = new ConfigService({
      app: {
        displaySidecar: {
          player: 'webcodecs',
          internalBaseUrl: 'http://sidecar.test',
        },
      },
    });
    const sessions = {
      tryCreateSessionForPreparedTarget: jest
        .fn()
        .mockResolvedValue({ id: 'display-session' }),
    };
    const bootstrap = new AndroidAppsViewerService(
      config,
      sessions as unknown as AndroidAppsDisplaySidecarService,
      queries as unknown as AndroidAppsQueryService,
      { recordViewerActivity: jest.fn() } as unknown as AndroidAppsStateWriter,
      viewer,
    );
    const adb = new AndroidAppsSidecarAdbService(config, viewer);
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ output: '' }))
      .mockResolvedValueOnce(
        Response.json({ message: 'Invalid command' }, { status: 422 }),
      )
      .mockResolvedValueOnce(Response.json({ output: '' }))
      .mockResolvedValueOnce(
        Response.json({ message: 'ADB unavailable' }, { status: 503 }),
      )
      .mockResolvedValueOnce(Response.json({ output: '' }));

    await bootstrap.scrcpySession(runtime.id);
    await adb.logcat(runtime, 300);
    await expect(adb.logcat(runtime, 300)).rejects.toThrow('Invalid command');
    await adb.logcat(runtime, 300);
    expect(sidecar.ensureSidecarOnNetwork).toHaveBeenCalledTimes(1);
    expect(networks.getContainerIpOnNetwork).toHaveBeenCalledTimes(1);
    expect(sidecar.connectAdb).toHaveBeenCalledTimes(1);

    await expect(adb.logcat(runtime, 300)).rejects.toThrow('ADB unavailable');
    await adb.logcat(runtime, 300);
    expect(sidecar.connectAdb).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it('coalesces in-flight preparation while allowing one waiter to cancel', async () => {
    const { viewer, sidecar } = setup();
    let attachmentReady!: (
      result: typeof connected & { sidecarGeneration: number },
    ) => void;
    sidecar.ensureSidecarOnNetwork.mockReturnValueOnce(
      new Promise((resolve) => {
        attachmentReady = resolve;
      }),
    );
    const controller = new AbortController();
    const first = viewer.prepareViewerTarget(runtime, controller.signal);
    const second = viewer.prepareViewerTarget(runtime);
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    attachmentReady({
      ...connected,
      sidecarGeneration: sidecar.adbTargetGeneration,
    });
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(second).resolves.toMatchObject({ udid: '172.18.0.2:5555' });
    expect(sidecar.ensureSidecarOnNetwork).toHaveBeenCalledTimes(1);
    expect(sidecar.connectAdb).toHaveBeenCalledTimes(1);
  });

  it.each([
    { containerId: 'replacement' },
    { lastStartedAt: new Date(2_000) },
    { networkPolicyRevision: 3 },
  ])(
    'does not reuse a prepared target after a stored runtime or policy change (%o)',
    async (change) => {
      const { viewer, sidecar, queries } = setup();
      const old = await viewer.prepareViewerTarget(runtime);
      const replacement = { ...runtime, ...change };
      queries.getStored.mockResolvedValue(replacement);
      const current = await viewer.prepareViewerTarget(replacement);
      viewer.invalidateViewerTarget(old);
      expect(await viewer.prepareViewerTarget(replacement)).toBe(current);
      expect(sidecar.connectAdb).toHaveBeenCalledTimes(2);
    },
  );

  it('rejects a sidecar restart during preparation and reuses the new generation after recovery', async () => {
    const { viewer, sidecar } = setup();
    sidecar.connectAdb.mockImplementationOnce(async () => {
      sidecar.adbTargetGeneration += 1;
      return connected;
    });
    await expect(viewer.prepareViewerTarget(runtime)).rejects.toThrow(
      'Display sidecar changed',
    );
    const recovered = await viewer.prepareViewerTarget(runtime);
    expect(await viewer.prepareViewerTarget(runtime)).toBe(recovered);
    sidecar.adbTargetGeneration += 1;
    expect(await viewer.prepareViewerTarget(runtime)).not.toBe(recovered);
    expect(sidecar.connectAdb).toHaveBeenCalledTimes(3);
  });

  it('drains an admitted ADB connect before detaching and discards its result', async () => {
    const { viewer, sidecar } = setup();
    let completeConnect!: (result: typeof connected) => void;
    const connecting = new Promise<void>((started) => {
      sidecar.connectAdb.mockImplementationOnce(() => {
        started();
        return new Promise((resolve) => {
          completeConnect = resolve;
        });
      });
    });
    const initial = expect(
      viewer.prepareViewerTarget(runtime),
    ).rejects.toBeInstanceOf(ViewerRuntimeChangedError);
    await connecting;
    const release = viewer.releaseNetwork(runtime);
    await expect(viewer.prepareViewerTarget(runtime)).rejects.toBeInstanceOf(
      ViewerRuntimeChangedError,
    );
    expect(sidecar.detachSidecarFromNetwork).not.toHaveBeenCalled();
    completeConnect(connected);
    await Promise.all([release, initial]);
    expect(sidecar.detachSidecarFromNetwork).toHaveBeenCalledTimes(1);
    await viewer.prepareViewerTarget(runtime);
    expect(sidecar.connectAdb).toHaveBeenCalledTimes(2);
  });
});

describe('viewer firewall refresh', () => {
  it.each([true, false])(
    'uses the current allowlist and revision even if the viewer snapshot had restrictions enabled = %s',
    async (networkPolicyEnabled) => {
      const { viewer, policy, writer } = setup();
      await viewer.prepareScrcpyAdbTarget(
        {
          ...runtime,
          networkPolicyEnabled,
          networkPolicyAllowCidrs: '["0.0.0.0/0"]',
          networkPolicyRevision: 1,
        },
        '172.18.0.2',
      );

      expect(policy.refreshViewerPolicy).toHaveBeenCalledWith(runtime);
      expect(policy.apply).not.toHaveBeenCalled();
      expect(policy.remove).not.toHaveBeenCalled();
      expect(writer.recordViewerNetworkPolicy).toHaveBeenCalledWith(
        runtime,
        expect.objectContaining({ status: 'applied' }),
      );
    },
  );

  it('leaves host rules and policy observations alone for an unrestricted app', async () => {
    const { viewer, policy, writer, sidecar } = setup({
      ...runtime,
      networkPolicyEnabled: false,
      networkPolicyRevision: 3,
    });
    await viewer.prepareScrcpyAdbTarget(runtime, '172.18.0.2');
    expect(policy.refreshViewerPolicy).not.toHaveBeenCalled();
    expect(policy.apply).not.toHaveBeenCalled();
    expect(policy.remove).not.toHaveBeenCalled();
    expect(writer.recordViewerNetworkPolicy).not.toHaveBeenCalled();
    expect(sidecar.connectAdb).toHaveBeenCalled();
  });

  it.each([{ containerId: 'replacement' }, { lastStartedAt: new Date(2000) }])(
    'rejects a replaced runtime before refreshing or connecting (%o)',
    async (change) => {
      const { viewer, policy, sidecar } = setup({ ...runtime, ...change });
      await expect(
        viewer.prepareScrcpyAdbTarget(runtime, '172.18.0.2'),
      ).rejects.toBeInstanceOf(ViewerRuntimeChangedError);
      expect(policy.refreshViewerPolicy).not.toHaveBeenCalled();
      expect(sidecar.connectAdb).not.toHaveBeenCalled();
    },
  );

  it('shares the gate with other policy changes before reading or writing', async () => {
    const { viewer, gate, queries, policy } = setup();
    await gate.run(runtime.id, async () => {
      await expect(
        viewer.prepareScrcpyAdbTarget(runtime, '172.18.0.2'),
      ).rejects.toThrow('A network policy change is already in progress');
    });
    expect(queries.getStored).not.toHaveBeenCalled();
    expect(policy.refreshViewerPolicy).not.toHaveBeenCalled();
  });
});
import { ConfigService } from '@nestjs/config';

describe('recovered viewer TCP ADB preparation', () => {
  const redroid = {
    ...runtime,
    containerImage: 'redroid/redroid:16.0.0-latest',
  };

  it('uses the shared preparation after firewall refresh and before connecting', async () => {
    const { viewer, policy, tcpAdb, sidecar } = setup(redroid);
    await viewer.prepareScrcpyAdbTarget(redroid, adbHost);
    expect(tcpAdb.prepare).toHaveBeenCalledWith(
      { containerId: redroid.containerId, adbPort: redroid.adbPort },
      expect.any(OperationDeadline),
    );
    expect(policy.refreshViewerPolicy.mock.invocationCallOrder[0]).toBeLessThan(
      tcpAdb.prepare.mock.invocationCallOrder[0]!,
    );
    expect(tcpAdb.prepare.mock.invocationCallOrder[0]).toBeLessThan(
      sidecar.connectAdb.mock.invocationCallOrder[0]!,
    );
  });

  it('preserves viewer log-then-probe behavior after guest preparation failure', async () => {
    const { viewer, tcpAdb, sidecar } = setup(redroid);
    tcpAdb.prepare.mockRejectedValue(new Error('guest setup failed'));
    await expect(
      viewer.prepareScrcpyAdbTarget(redroid, adbHost),
    ).resolves.toEqual(connected);
    expect(sidecar.connectAdb).toHaveBeenCalledWith(adbHost, redroid.adbPort);
  });

  it('forwards the provisioning observation budget to container inspection', async () => {
    const { viewer, lifecycle } = setup();
    const options = {
      deadline: new OperationDeadline(100),
      signal: new AbortController().signal,
    };
    await viewer.observeProvisioningAdbTarget(runtime, options);
    expect(lifecycle.inspectContainer).toHaveBeenCalledWith(
      runtime.containerId,
      options,
    );
  });
});
