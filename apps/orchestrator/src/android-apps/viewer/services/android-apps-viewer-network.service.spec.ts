import { OperationDeadline } from '../../../common/operation-deadline';
import type { AndroidAppsTcpAdbService } from '../../common/services/android-apps-tcp-adb.service';
import type { DockerContainerLifecyclePort } from '../../../docker/contracts/docker-container-lifecycle.port';
import type { DockerNetworkRuntimePort } from '../../../docker/contracts/docker-network-runtime.port';
import type { DockerSidecarPort } from '../../../docker/contracts/docker-sidecar.port';
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
  };
}

describe('shared viewer target preparation', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reuses provisioning ADB readiness after verifying the live target and applying viewer policy', async () => {
    const { viewer, policy, sidecar, lifecycle } = setup();
    const target = { ...connected, message: 'verified during provisioning' };
    const observed = await viewer.observeProvisioningAdbTarget(runtime);
    viewer.rememberProvisionedAdb(runtime, {
      ...observed,
      sidecarGeneration: sidecar.adbTargetGeneration,
      target,
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
    });

    await viewer.prepareViewerTarget(updatedRuntime);
    expect(lifecycle.inspectContainer).not.toHaveBeenCalled();
    expect(policy.refreshViewerPolicy).toHaveBeenCalledWith(updatedRuntime);
    expect(sidecar.connectAdb).toHaveBeenCalledWith(adbHost, runtime.adbPort);
  });

  it('uses one network attachment, address read and ADB connect for a Display session and notification tool', async () => {
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
    await adb.notifications(runtime);
    await expect(adb.notifications(runtime)).rejects.toThrow('Invalid command');
    await adb.notifications(runtime);
    expect(sidecar.ensureSidecarOnNetwork).toHaveBeenCalledTimes(1);
    expect(networks.getContainerIpOnNetwork).toHaveBeenCalledTimes(1);
    expect(sidecar.connectAdb).toHaveBeenCalledTimes(1);

    await expect(adb.notifications(runtime)).rejects.toThrow('ADB unavailable');
    await adb.notifications(runtime);
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
