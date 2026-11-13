import { ConfigService } from '@nestjs/config';
import { OperationDeadline } from '../../../common/operation-deadline';
import { DockerContainerLifecycleService } from '../../containers/services/docker-container-lifecycle.service';
import type { DockerEngineService } from '../../docker-engine.service';
import type { DockerSidecarAttachmentTimings } from '../../contracts/docker-sidecar.port';
import type { DockerSidecarAdbService } from './docker-sidecar-adb.service';
import type { DockerSidecarApiService } from './docker-sidecar-api.service';
import type { DockerSidecarImageService } from './docker-sidecar-image.service';
import { DockerSidecarNetworkService } from './docker-sidecar-network.service';
import { DockerSidecarService } from './docker-sidecar.service';
import type { DockerNetworkRuntimeService } from '../../networks/services/docker-network-runtime.service';

const id = 'a'.repeat(64);
const sidecarName = 'rebroid.display-sidecar';

const setup = (containerId?: string, running = true) => {
  const config = new ConfigService({
    app: {
      displaySidecar: {
        containerId,
        containerName: sidecarName,
        image: 'rebroid/display-sidecar:latest',
        buildContext: '../display-sidecar',
        autoStart: false,
        port: 8000,
        publishedHostPort: 0,
        webrtcUdpPort: 40000,
        webrtcIceHost: '',
      },
    },
  });
  const container = {
    id,
    inspect: jest.fn().mockResolvedValue({
      Id: id,
      Name: `/${sidecarName}`,
      State: { Running: running },
      NetworkSettings: {
        Networks: { 'app-network': { IPAddress: '172.20.0.2' } },
      },
    }),
    start: jest.fn().mockResolvedValue(undefined),
  };
  const listContainers = jest.fn().mockResolvedValue([
    { Id: 'unrelated', Names: [`/${sidecarName}-unrelated`] },
    { Id: id, Names: [`/${sidecarName}`] },
  ]);
  const getContainer = jest.fn().mockReturnValue(container);
  const engine = {
    docker: { listContainers, getContainer },
    read: <T>(operation: () => Promise<T>) => operation(),
    coalesceRead: <T>(_key: string, operation: () => Promise<T>) => operation(),
    mutate: <T>(operation: () => Promise<T>) => operation(),
    isDockerNotFound: (error: { statusCode?: number }) =>
      error.statusCode === 404,
  } as unknown as DockerEngineService;
  const lifecycle = new DockerContainerLifecycleService(engine);
  const connectContainerToNetwork = jest.fn().mockResolvedValue(undefined);
  const network = new DockerSidecarNetworkService(config, engine, {
    connectContainerToNetwork,
  } as unknown as DockerNetworkRuntimeService);
  const waitForReady = jest.fn().mockResolvedValue(undefined);
  const prepareTarget = jest
    .fn()
    .mockResolvedValue({ configured: true, connected: true });
  const service = new DockerSidecarService(
    config,
    engine,
    lifecycle,
    { prepareTarget } as unknown as DockerSidecarAdbService,
    { waitForReady } as unknown as DockerSidecarApiService,
    network,
    {} as DockerSidecarImageService,
  );
  return {
    service,
    container,
    listContainers,
    getContainer,
    waitForReady,
    connectContainerToNetwork,
    prepareTarget,
  };
};

describe('display sidecar discovery', () => {
  it('observes published port load without adding Docker calls to a warm attachment', async () => {
    const { service, container, connectContainerToNetwork } = setup();
    const original = await container.inspect();
    container.inspect.mockClear();
    container.inspect.mockResolvedValue({
      ...original,
      NetworkSettings: {
        ...original.NetworkSettings,
        Ports: {
          '8000/tcp': null,
          ...Object.fromEntries(
            Array.from({ length: 101 }, (_, index) => [
              `${40000 + index}/udp`,
              [
                { HostIp: '0.0.0.0', HostPort: String(40000 + index) },
                { HostIp: '::', HostPort: String(40000 + index) },
              ],
            ]),
          ),
        },
      },
    });
    const timings: DockerSidecarAttachmentTimings = {
      sidecarQueueMs: 0,
      sidecarPreparationMs: 0,
      networkInspectMs: 0,
      dockerMutationQueueMs: 0,
      networkConnectMs: 0,
      networkConvergenceMs: 0,
    };

    await service.ensureSidecarOnNetwork('app-network', undefined, timings);

    expect(timings).toMatchObject({
      sidecarPublishedPortCount: 101,
      sidecarPublishedBindingCount: 202,
      networkConnectMs: 0,
    });
    expect(container.inspect).toHaveBeenCalledTimes(1);
    expect(connectContainerToNetwork).not.toHaveBeenCalled();
  });

  it('separates sidecar FIFO wait from discovery preparation', async () => {
    jest.useFakeTimers();
    try {
      const { service, container } = setup();
      const original = await container.inspect();
      container.inspect.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(original), 500);
          }),
      );
      const first = service.ensureSidecarOnNetwork('app-network');
      const timings = {
        sidecarQueueMs: 0,
        sidecarPreparationMs: 0,
        networkInspectMs: 0,
        dockerMutationQueueMs: 0,
        networkConnectMs: 0,
        networkConvergenceMs: 0,
      };
      const second = service.ensureSidecarOnNetwork(
        'app-network',
        undefined,
        timings,
      );
      await jest.advanceTimersByTimeAsync(500);
      await Promise.all([first, second]);
      expect(timings.sidecarQueueMs).toBe(500);
      expect(timings.sidecarPreparationMs).toBe(0);
      expect(timings.networkConnectMs).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('filters inventory by exact name and reuses the running container inspection', async () => {
    const { service, container, listContainers, getContainer } = setup();

    await expect(
      service.ensureSidecarOnNetwork('app-network'),
    ).resolves.toMatchObject({ connected: true });
    expect(listContainers).toHaveBeenCalledWith({
      all: true,
      filters: { name: ['^/?rebroid\\.display-sidecar$'] },
    });
    expect(getContainer).toHaveBeenCalledWith(id);
    expect(container.inspect).toHaveBeenCalledTimes(1);
    expect(container.start).not.toHaveBeenCalled();
  });

  it('resolves a configured container once and uses its full Docker ID', async () => {
    const { service, container, listContainers, getContainer } =
      setup('configured-alias');

    await expect(
      service.ensureSidecarOnNetwork('app-network'),
    ).resolves.toMatchObject({ connected: true });
    expect(listContainers).not.toHaveBeenCalled();
    expect(getContainer.mock.calls).toEqual([['configured-alias'], [id]]);
    expect(container.inspect).toHaveBeenCalledTimes(1);
  });

  it('rechecks network state after starting a stopped sidecar', async () => {
    const { service, container, waitForReady } = setup(undefined, false);

    await expect(
      service.ensureSidecarOnNetwork('app-network'),
    ).resolves.toMatchObject({ connected: true });
    expect(container.start).toHaveBeenCalledTimes(1);
    expect(waitForReady).toHaveBeenCalledTimes(1);
    expect(container.inspect).toHaveBeenCalledTimes(2);
  });

  it('reports a new ADB generation after observing the same container restart', async () => {
    const { service, container } = setup();
    const inspect = (startedAt: string) => ({
      Id: id,
      Name: `/${sidecarName}`,
      State: { Running: true, StartedAt: startedAt },
      NetworkSettings: {
        Networks: { 'app-network': { IPAddress: '172.20.0.2' } },
      },
    });
    container.inspect
      .mockResolvedValueOnce(inspect('2026-11-12T10:00:00Z'))
      .mockResolvedValueOnce(inspect('2026-11-12T10:01:00Z'));
    const original = await service.ensureSidecarOnNetwork('app-network');
    const restarted = await service.ensureSidecarOnNetwork('app-network');
    expect(restarted.sidecarGeneration).toBeGreaterThan(
      original.sidecarGeneration,
    );
    expect(service.adbTargetGeneration).toBe(restarted.sidecarGeneration);
  });
});

describe('sidecar admission and identity reuse', () => {
  async function flush() {
    for (let turn = 0; turn < 20; turn++) await Promise.resolve();
  }

  it('reuses the discovered ID for ADB preparation while inspecting fresh state', async () => {
    const { service, container, listContainers, prepareTarget } = setup();
    await service.ensureSidecarOnNetwork('app-network');
    await service.connectAdb('172.20.0.3', 5555);
    expect(listContainers).toHaveBeenCalledTimes(1);
    expect(container.inspect).toHaveBeenCalledTimes(2);
    expect(prepareTarget).toHaveBeenCalledTimes(1);
  });

  it('rediscovers a removed cached ID and invalidates the previous generation', async () => {
    const { service, container, listContainers, getContainer } = setup();
    const initial = await service.ensureSidecarOnNetwork('app-network');
    const replacementId = 'b'.repeat(64);
    const replacement = {
      id: replacementId,
      inspect: jest.fn().mockResolvedValue({
        Id: replacementId,
        Name: `/${sidecarName}`,
        State: { Running: true, StartedAt: 'replacement' },
        NetworkSettings: {
          Networks: { 'app-network': { IPAddress: '172.20.0.4' } },
        },
      }),
    };
    container.inspect.mockRejectedValueOnce(
      Object.assign(new Error('missing'), { statusCode: 404 }),
    );
    listContainers.mockResolvedValue([
      { Id: replacementId, Names: [`/${sidecarName}`] },
    ]);
    getContainer.mockImplementation((containerId: string) =>
      containerId === replacementId ? replacement : container,
    );
    const replaced = await service.ensureSidecarOnNetwork('app-network');
    expect(listContainers).toHaveBeenCalledTimes(2);
    expect(replacement.inspect).toHaveBeenCalledTimes(1);
    expect(replaced.sidecarGeneration).toBeGreaterThan(
      initial.sidecarGeneration,
    );
    expect(replaced.message).toContain('172.20.0.4');
  });

  it('rediscovers by exact name when a previously discovered container is renamed', async () => {
    const { service, container, listContainers } = setup();
    await service.ensureSidecarOnNetwork('app-network');
    const current = await container.inspect();
    container.inspect.mockResolvedValueOnce({
      ...current,
      Name: '/renamed-old-sidecar',
    });
    listContainers.mockResolvedValue([]);
    await expect(
      service.ensureSidecarOnNetwork('app-network'),
    ).resolves.toMatchObject({ configured: false });
    expect(listContainers).toHaveBeenCalledTimes(2);
  });

  it.each(['expired', 'cancelled'])(
    'withdraws %s sidecar work before discovery without waiting for its predecessor',
    async (reason) => {
      jest.useFakeTimers();
      try {
        const { service, container, listContainers } = setup();
        const inspect = await container.inspect();
        container.inspect.mockClear();
        let release!: (value: typeof inspect) => void;
        container.inspect.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              release = resolve;
            }),
        );
        const first = service.ensureSidecarOnNetwork('app-network');
        await flush();
        const controller = new AbortController();
        const timings = {
          sidecarQueueMs: 0,
          sidecarPreparationMs: 0,
          networkInspectMs: 0,
          dockerMutationQueueMs: 0,
          networkConnectMs: 0,
          networkConvergenceMs: 0,
        };
        const second = service.ensureSidecarOnNetwork(
          'app-network',
          new OperationDeadline(100),
          timings,
          controller.signal,
        );
        const rejected = expect(second).rejects.toThrow(
          reason === 'expired' ? 'deadline' : 'cancelled',
        );
        if (reason === 'cancelled') {
          await jest.advanceTimersByTimeAsync(50);
          controller.abort(new Error('cancelled'));
        } else await jest.advanceTimersByTimeAsync(100);
        await rejected;
        expect(timings.sidecarQueueMs).toBe(reason === 'expired' ? 100 : 50);
        expect(container.inspect).toHaveBeenCalledTimes(1);
        release(inspect);
        await first;
        await flush();
        expect(container.inspect).toHaveBeenCalledTimes(1);
        expect(listContainers).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('drains an admitted attachment and verifies it before releasing the sidecar queue on cancellation', async () => {
    const { service, container, connectContainerToNetwork } = setup();
    const attached = await container.inspect();
    container.inspect.mockClear();
    container.inspect.mockResolvedValueOnce({
      ...attached,
      NetworkSettings: { Networks: {} },
    });
    let release!: () => void;
    connectContainerToNetwork.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const controller = new AbortController();
    const first = service.ensureSidecarOnNetwork(
      'app-network',
      undefined,
      undefined,
      controller.signal,
    );
    const rejected = expect(first).rejects.toThrow('cancelled');
    await flush();
    expect(connectContainerToNetwork).toHaveBeenCalledTimes(1);
    controller.abort(new Error('cancelled'));
    let secondCompleted = false;
    const second = service.ensureSidecarOnNetwork('app-network').then(() => {
      secondCompleted = true;
    });
    await flush();
    expect(secondCompleted).toBe(false);
    release();
    await rejected;
    await second;
    expect(container.inspect).toHaveBeenCalledTimes(3);
    expect(connectContainerToNetwork).toHaveBeenCalledTimes(1);
  });
});
