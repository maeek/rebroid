import { ConfigService } from '@nestjs/config';
import type Dockerode from 'dockerode';
import { DockerContainerLifecycleService } from '../containers/services/docker-container-lifecycle.service';
import { DockerPlatformContainersService } from '../containers/services/docker-platform-containers.service';
import { DockerEngineService } from '../docker-engine.service';
import { DockerPlatformImagesService } from '../images/services/docker-platform-images.service';
import { DockerPlatformNetworksService } from '../networks/services/docker-platform-networks.service';
import { DockerInventoryService } from './docker-inventory.service';

const container: Dockerode.ContainerInfo = {
  Id: 'container-1',
  Names: ['/app'],
  Image: 'example/image:latest',
  ImageID: 'sha256:image-1',
  Command: 'sleep infinity',
  Created: 1,
  State: 'running',
  Status: 'Up one minute',
  Labels: { 'com.rebroid.managed': 'true' },
  Ports: [],
  Mounts: [],
  HostConfig: { NetworkMode: 'network-1' },
  NetworkSettings: {
    Networks: {
      'network-1': {
        NetworkID: 'network-1',
        EndpointID: 'endpoint-1',
        Gateway: '172.17.0.1',
        IPAddress: '172.17.0.2',
        IPPrefixLen: 16,
        IPv6Gateway: '',
        GlobalIPv6Address: '',
        GlobalIPv6PrefixLen: 0,
        MacAddress: '',
      },
    },
  },
};

const image = {
  Id: container.ImageID,
  RepoTags: [container.Image],
  Created: 1,
} as Dockerode.ImageInfo;

const network = {
  Id: 'network-1',
  Name: 'network-1',
  Driver: 'bridge',
  Scope: 'local',
} as Dockerode.NetworkInspectInfo;

const containerInspect = {
  Id: container.Id,
  Name: '/app',
  Image: container.ImageID,
  Created: new Date(1000).toISOString(),
  Config: { Image: container.Image },
  State: { Status: 'running' },
  NetworkSettings: { Networks: { 'network-1': {} } },
};

function fixture() {
  const engine = new DockerEngineService(
    new ConfigService({
      app: {
        docker: {
          socketPath: '/var/run/docker.sock',
          requestTimeoutMs: 15_000,
          slowRequestWarningMs: 5_000,
          maxConcurrentReads: 4,
          longOperationTimeoutMs: 30_000,
          maxConcurrentLongOperations: 4,
          resourcePrefix: 'rebroid',
        },
      },
    }),
  );
  const listContainers = jest
    .spyOn(engine.docker, 'listContainers')
    .mockResolvedValue([container]);
  const listImages = jest
    .spyOn(engine.docker, 'listImages')
    .mockResolvedValue([image]);
  const listNetworks = jest
    .spyOn(engine.docker, 'listNetworks')
    .mockResolvedValue([network]);
  const inspectContainer = jest.fn().mockResolvedValue(containerInspect);
  const inspectNetwork = jest.fn().mockResolvedValue(network);
  jest
    .spyOn(engine.docker, 'getContainer')
    .mockReturnValue({ inspect: inspectContainer } as never);
  jest
    .spyOn(engine.docker, 'getNetwork')
    .mockReturnValue({ inspect: inspectNetwork } as never);
  const inventory = new DockerInventoryService(engine);
  const lifecycle = new DockerContainerLifecycleService(engine);
  const containers = new DockerPlatformContainersService(
    engine,
    lifecycle,
    {} as never,
    inventory,
  );
  const metadata = {
    enrichPlatformImages: (images: unknown) => Promise.resolve(images),
  };
  const images = new DockerPlatformImagesService(
    engine,
    {} as never,
    metadata as never,
    inventory,
  );
  const networks = new DockerPlatformNetworksService(engine, inventory);
  return {
    engine,
    inventory,
    containers,
    images,
    networks,
    listContainers,
    listImages,
    listNetworks,
    inspectContainer,
    inspectNetwork,
  };
}

describe('Docker display inventory', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('shares three list calls across the inventory views and keeps detail inspections fresh', async () => {
    const {
      inventory,
      containers,
      images,
      networks,
      listContainers,
      listImages,
      listNetworks,
      inspectContainer,
      inspectNetwork,
    } = fixture();
    await expect(containers.listPlatformContainers()).resolves.toMatchObject([
      { id: container.Id },
    ]);
    const [details, availableImages, availableNetworks, managed] =
      await Promise.all([
        containers.getPlatformContainerDetails(container.Id),
        images.listPlatformImages(),
        networks.listPlatformNetworks(),
        inventory.listManagedContainers(),
      ]);
    expect(details.relatedImage?.id).toBe(image.Id);
    expect(details.relatedNetworks).toMatchObject([{ id: network.Id }]);
    expect(availableImages).toMatchObject([{ id: image.Id, managed: true }]);
    expect(availableNetworks).toMatchObject([{ id: network.Id }]);
    expect(managed).toEqual([
      {
        id: container.Id,
        name: 'app',
        state: 'running',
        status: container.Status,
      },
    ]);
    await expect(
      networks.getPlatformNetworkDetails(network.Id),
    ).resolves.toMatchObject({ relatedContainers: [{ id: container.Id }] });
    inspectContainer.mockResolvedValueOnce({
      ...containerInspect,
      State: { Status: 'exited' },
      NetworkSettings: { Networks: {} },
    });
    await expect(
      containers.getPlatformContainerDetails(container.Id),
    ).resolves.toMatchObject({
      container: { state: 'exited', status: 'exited', networks: [] },
      relatedNetworks: [],
    });
    expect(listContainers).toHaveBeenCalledTimes(1);
    expect(listImages).toHaveBeenCalledTimes(1);
    expect(listNetworks).toHaveBeenCalledTimes(1);
    expect(inspectContainer).toHaveBeenCalledTimes(2);
    expect(inspectNetwork).toHaveBeenCalledTimes(1);
  });

  it('keeps the managed scope filtered on a cold inventory and expires external changes', async () => {
    jest.useFakeTimers();
    const { inventory, listContainers } = fixture();
    await Promise.all([
      inventory.listManagedContainers(),
      inventory.listManagedContainers(),
    ]);
    expect(listContainers).toHaveBeenCalledTimes(1);
    expect(listContainers).toHaveBeenLastCalledWith({
      all: true,
      filters: { label: ['com.rebroid.managed=true'] },
    });
    listContainers.mockResolvedValue([]);
    await jest.advanceTimersByTimeAsync(4_999);
    await expect(inventory.listManagedContainers()).resolves.toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);
    await expect(inventory.listManagedContainers()).resolves.toEqual([]);
    expect(listContainers).toHaveBeenCalledTimes(2);
    await inventory.listContainers();
    expect(listContainers).toHaveBeenLastCalledWith({ all: true });
  });

  it('does not let a pre-mutation inventory flight replace fresh data after the write', async () => {
    const { inventory, listContainers, engine } = fixture();
    let release!: (value: Dockerode.ContainerInfo[]) => void;
    listContainers.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const oldRead = inventory.listContainers();
    await Promise.resolve();
    await engine.mutate(async () => undefined);
    listContainers.mockResolvedValue([]);
    await expect(inventory.listContainers()).resolves.toEqual([]);
    release([container]);
    await expect(oldRead).resolves.toHaveLength(1);
    await expect(inventory.listContainers()).resolves.toEqual([]);
    expect(listContainers).toHaveBeenCalledTimes(2);
  });

  it('returns an oversized inventory without retaining it', async () => {
    const { inventory, listContainers } = fixture();
    listContainers.mockResolvedValue([
      { ...container, Command: 'x'.repeat(1024 * 1024) },
    ]);
    await expect(inventory.listContainers()).resolves.toHaveLength(1);
    await expect(inventory.listContainers()).resolves.toHaveLength(1);
    expect(listContainers).toHaveBeenCalledTimes(2);
  });
});
