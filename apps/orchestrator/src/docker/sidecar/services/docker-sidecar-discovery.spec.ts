import { ConfigService } from '@nestjs/config';
import { DockerContainerLifecycleService } from '../../containers/services/docker-container-lifecycle.service';
import type { DockerEngineService } from '../../docker-engine.service';
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
        webrtcUdpPortRange: '',
        webrtcIceHost: '',
      },
    },
  });
  const container = {
    id,
    inspect: jest.fn().mockResolvedValue({
      Id: id,
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
  } as unknown as DockerEngineService;
  const lifecycle = new DockerContainerLifecycleService(engine);
  const network = new DockerSidecarNetworkService(
    config,
    engine,
    {} as DockerNetworkRuntimeService,
  );
  const waitForReady = jest.fn().mockResolvedValue(undefined);
  const service = new DockerSidecarService(
    config,
    engine,
    lifecycle,
    {} as DockerSidecarAdbService,
    { waitForReady } as unknown as DockerSidecarApiService,
    network,
    {} as DockerSidecarImageService,
  );
  return { service, container, listContainers, getContainer, waitForReady };
};

describe('display sidecar discovery', () => {
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
