import { ConflictException, Injectable } from '@nestjs/common';
import Dockerode from 'dockerode';
import { DockerEngineService } from './docker-engine.service';
import { DockerRuntimeService } from './docker-runtime.service';
import {
  PlatformContainer,
  PlatformContainerDetails,
  PlatformContainerLog,
  PlatformImage,
  PlatformImageDetails,
  PlatformNetwork,
  PlatformNetworkDetails,
} from './docker.types';
import { isString, shortDockerId } from './docker.utils';

@Injectable()
export class DockerPlatformService {
  constructor(
    private readonly engine: DockerEngineService,
    private readonly runtime: DockerRuntimeService,
  ) {}

  async listPlatformImages(): Promise<PlatformImage[]> {
    const images = await this.engine.docker.listImages({ all: true });
    return images.map((image) => ({
      id: image.Id,
      shortId: shortDockerId(image.Id),
      repoTags: image.RepoTags?.filter((tag) => tag !== '<none>:<none>') ?? [],
      repoDigests: image.RepoDigests ?? [],
      sizeBytes: image.Size ?? 0,
      sharedSizeBytes: image.SharedSize ?? 0,
      virtualSizeBytes: image.VirtualSize ?? image.Size ?? 0,
      createdAt: new Date((image.Created ?? 0) * 1000).toISOString(),
      labels: image.Labels ?? {},
      containers: image.Containers ?? 0,
    }));
  }

  async listPlatformNetworks(): Promise<PlatformNetwork[]> {
    const networks = await this.engine.docker.listNetworks();
    return networks.map((network) => {
      const containers = Object.keys(network.Containers ?? {});
      const ipamConfig = network.IPAM?.Config ?? [];

      return {
        id: network.Id,
        shortId: network.Id.slice(0, 12),
        name: network.Name,
        driver: network.Driver,
        scope: network.Scope,
        createdAt: network.Created ?? null,
        internal: Boolean(network.Internal),
        attachable: Boolean(network.Attachable),
        ingress: Boolean(network.Ingress),
        labels: network.Labels ?? {},
        managed: network.Labels?.['com.rebroid.managed'] === 'true',
        containers,
        subnets: ipamConfig.map((item) => item.Subnet).filter(isString),
        gateways: ipamConfig.map((item) => item.Gateway).filter(isString),
      };
    });
  }

  async listPlatformContainers(): Promise<PlatformContainer[]> {
    const containers = await this.engine.docker.listContainers({ all: true });
    return containers.map((container) => this.platformContainerFromInfo(container));
  }

  async getPlatformContainerDetails(
    containerId: string,
  ): Promise<PlatformContainerDetails> {
    const container = this.engine.docker.getContainer(containerId);
    const inspect = await container.inspect();
    const listItem =
      (await this.findContainerByIdOrName(containerId)) ??
      this.platformContainerFromInspect(inspect);
    const [images, networks] = await Promise.all([
      this.listPlatformImages(),
      this.listPlatformNetworks(),
    ]);
    const relatedImage =
      images.find(
        (image) =>
          image.id === inspect.Image ||
          image.id === listItem.imageId ||
          image.repoTags.includes(listItem.image),
      ) ?? null;
    const containerNetworkNames = new Set(listItem.networks);

    return {
      container: listItem,
      inspect,
      relatedImage,
      relatedNetworks: networks.filter((network) =>
        containerNetworkNames.has(network.name),
      ),
    };
  }

  async getPlatformContainerLogs(
    containerId: string,
    tail = 500,
  ): Promise<PlatformContainerLog> {
    return {
      source: 'container',
      collectedAt: new Date().toISOString(),
      output: await this.engine.getContainerLogs(containerId, tail),
    };
  }

  async stopPlatformContainer(containerId: string) {
    await this.assertNotOrchestratorContainer(containerId);
    await this.engine.stopContainer(containerId);
    return { id: containerId, stopped: true };
  }

  async removePlatformContainer(containerId: string, force = false) {
    await this.assertNotOrchestratorContainer(containerId);
    await this.engine.removeContainer(containerId, { force });
    return { id: containerId, removed: true };
  }

  async getPlatformImageDetails(imageId: string): Promise<PlatformImageDetails> {
    const image = this.engine.docker.getImage(imageId);
    const inspect = await image.inspect();
    const [images, containers] = await Promise.all([
      this.listPlatformImages(),
      this.listPlatformContainers(),
    ]);
    const listItem =
      images.find(
        (item) =>
          item.id === inspect.Id ||
          item.shortId === shortDockerId(inspect.Id) ||
          item.repoTags.includes(imageId) ||
          item.repoDigests.includes(imageId),
      ) ?? this.platformImageFromInspect(inspect);
    const relatedContainers = containers.filter(
      (container) =>
        container.imageId === listItem.id ||
        container.imageId === inspect.Id ||
        listItem.repoTags.includes(container.image),
    );

    return {
      image: listItem,
      inspect,
      relatedContainers,
    };
  }

  async removePlatformImage(image: string, force = false) {
    await this.runtime.removeImage(image, force);
    return { id: image, removed: true };
  }

  async pruneImages(danglingOnly = true) {
    return this.engine.docker.pruneImages({
      dangling: danglingOnly ? ['true'] : ['false'],
    });
  }

  async pruneContainers() {
    return this.engine.docker.pruneContainers();
  }

  async pruneNetworks() {
    return this.engine.docker.pruneNetworks();
  }

  async pruneVolumes() {
    return this.engine.docker.pruneVolumes();
  }

  async removePlatformNetwork(networkId: string) {
    await this.engine.docker.getNetwork(networkId).remove();
    return { id: networkId, removed: true };
  }

  async getPlatformNetworkDetails(
    networkId: string,
  ): Promise<PlatformNetworkDetails> {
    const network = this.engine.docker.getNetwork(networkId);
    const inspect = await network.inspect();
    const [networks, containers] = await Promise.all([
      this.listPlatformNetworks(),
      this.listPlatformContainers(),
    ]);
    const listItem =
      networks.find((item) => item.id === inspect.Id || item.name === inspect.Name) ??
      this.platformNetworkFromInspect(inspect);

    return {
      network: listItem,
      inspect,
      relatedContainers: containers.filter((container) =>
        container.networks.includes(listItem.name),
      ),
    };
  }

  private async findContainerByIdOrName(idOrName: string) {
    const containers = await this.engine.docker.listContainers({ all: true });
    const dockerName = `/${idOrName}`;
    const found = containers.find(
      (container) =>
        container.Id === idOrName ||
        container.Id.startsWith(idOrName) ||
        container.Names.includes(dockerName),
    );
    return found ? this.platformContainerFromInfo(found) : null;
  }

  private platformContainerFromInfo(
    container: Dockerode.ContainerInfo,
  ): PlatformContainer {
    return {
      id: container.Id,
      shortId: container.Id.slice(0, 12),
      names: container.Names.map((name) => name.replace(/^\//, '')),
      image: container.Image,
      imageId: container.ImageID,
      command: container.Command,
      createdAt: new Date(container.Created * 1000).toISOString(),
      state: container.State,
      status: container.Status,
      labels: container.Labels ?? {},
      managed: container.Labels?.['com.rebroid.managed'] === 'true',
      applicationId:
        container.Labels?.['com.rebroid.application-id'] ?? null,
      component: container.Labels?.['com.rebroid.component'] ?? null,
      ports: (container.Ports ?? []).map((port) => ({
        privatePort: port.PrivatePort,
        publicPort: port.PublicPort ?? null,
        type: port.Type,
        ip: port.IP ?? null,
      })),
      networks: Object.keys(container.NetworkSettings?.Networks ?? {}),
    };
  }

  private platformImageFromInspect(
    inspect: Dockerode.ImageInspectInfo,
  ): PlatformImage {
    const sharedSize =
      'SharedSize' in inspect && typeof inspect.SharedSize === 'number'
        ? inspect.SharedSize
        : 0;

    return {
      id: inspect.Id,
      shortId: shortDockerId(inspect.Id),
      repoTags: inspect.RepoTags?.filter((tag) => tag !== '<none>:<none>') ?? [],
      repoDigests: inspect.RepoDigests ?? [],
      sizeBytes: inspect.Size ?? 0,
      sharedSizeBytes: sharedSize,
      virtualSizeBytes: inspect.VirtualSize ?? inspect.Size ?? 0,
      createdAt: new Date(inspect.Created).toISOString(),
      labels: inspect.Config?.Labels ?? {},
      containers: -1,
    };
  }

  private platformNetworkFromInspect(
    inspect: Dockerode.NetworkInspectInfo,
  ): PlatformNetwork {
    const ipamConfig = inspect.IPAM?.Config ?? [];
    return {
      id: inspect.Id,
      shortId: inspect.Id.slice(0, 12),
      name: inspect.Name,
      driver: inspect.Driver,
      scope: inspect.Scope,
      createdAt: inspect.Created ?? null,
      internal: Boolean(inspect.Internal),
      attachable: Boolean(inspect.Attachable),
      ingress: Boolean(inspect.Ingress),
      labels: inspect.Labels ?? {},
      managed: inspect.Labels?.['com.rebroid.managed'] === 'true',
      containers: Object.keys(inspect.Containers ?? {}),
      subnets: ipamConfig.map((item) => item.Subnet).filter(isString),
      gateways: ipamConfig.map((item) => item.Gateway).filter(isString),
    };
  }

  private platformContainerFromInspect(
    inspect: Dockerode.ContainerInspectInfo,
  ): PlatformContainer {
    const labels = inspect.Config?.Labels ?? {};
    return {
      id: inspect.Id,
      shortId: inspect.Id.slice(0, 12),
      names: [inspect.Name?.replace(/^\//, '') || inspect.Id.slice(0, 12)],
      image: inspect.Config?.Image ?? inspect.Image,
      imageId: inspect.Image,
      command: inspect.Path
        ? [inspect.Path, ...(inspect.Args ?? [])].filter(Boolean).join(' ')
        : '',
      createdAt: new Date(inspect.Created).toISOString(),
      state: inspect.State?.Status ?? 'unknown',
      status: inspect.State?.Status ?? 'unknown',
      labels,
      managed: labels['com.rebroid.managed'] === 'true',
      applicationId: labels['com.rebroid.application-id'] ?? null,
      component: labels['com.rebroid.component'] ?? null,
      ports: Object.entries(inspect.NetworkSettings?.Ports ?? {}).flatMap(
        ([key, bindings]) => {
          const [privatePort, type] = key.split('/');
          if (!bindings) {
            return [
              {
                privatePort: Number(privatePort),
                publicPort: null,
                type: type ?? 'tcp',
                ip: null,
              },
            ];
          }

          return bindings.map((binding) => ({
            privatePort: Number(privatePort),
            publicPort: binding.HostPort ? Number(binding.HostPort) : null,
            type: type ?? 'tcp',
            ip: binding.HostIp || null,
          }));
        },
      ),
      networks: Object.keys(inspect.NetworkSettings?.Networks ?? {}),
    };
  }

  private async assertNotOrchestratorContainer(containerId: string) {
    if (!this.engine.orchestratorContainerId) {
      return;
    }

    const inspect = await this.engine.inspectContainer(containerId);
    const configuredIdOrName = this.engine.orchestratorContainerId.replace(
      /^\//,
      '',
    );
    const names = (inspect.Name ? [inspect.Name] : [])
      .map((name) => name.replace(/^\//, ''))
      .filter(Boolean);
    const matchesConfigured =
      inspect.Id === configuredIdOrName ||
      inspect.Id.startsWith(configuredIdOrName) ||
      names.includes(configuredIdOrName);

    if (matchesConfigured) {
      throw new ConflictException(
        'The orchestrator container cannot stop or remove itself.',
      );
    }
  }
}