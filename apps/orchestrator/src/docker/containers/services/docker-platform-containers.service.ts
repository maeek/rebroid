import { ConflictException, Injectable } from '@nestjs/common';
import { DockerEngineService } from '../../docker-engine.service';
import {
  PlatformContainer,
  PlatformContainerDetails,
  PlatformContainerLog,
} from '../../docker.types';
import {
  platformContainerFromInfo,
  platformContainerFromInspect,
} from '../utils/platform-container.utils';
import { platformImageFromSummary } from '../../images/utils/platform-image.utils';
import { platformNetworkFromSummary } from '../../networks/utils/platform-network.utils';
import { DockerContainerLifecycleService } from './docker-container-lifecycle.service';
import { DockerResourceRuntimeService } from '../../resources/services/docker-resource-runtime.service';
import type {
  AdmitPlatformContainerChange,
  DockerPlatformContainersPort,
} from '../../contracts/docker-platform-containers.port';

@Injectable()
export class DockerPlatformContainersService implements DockerPlatformContainersPort {
  constructor(
    private readonly engine: DockerEngineService,
    private readonly lifecycle: DockerContainerLifecycleService,
    private readonly resources: DockerResourceRuntimeService,
  ) {}

  async listPlatformContainers(): Promise<PlatformContainer[]> {
    const containers = await this.engine.read(
      () => this.engine.docker.listContainers({ all: true }),
      'List platform containers',
    );
    return containers.map((container) => platformContainerFromInfo(container));
  }

  async getPlatformContainerDetails(
    containerId: string,
  ): Promise<PlatformContainerDetails> {
    const container = this.engine.docker.getContainer(containerId);
    const inspect = await this.engine.read(
      () => container.inspect(),
      `Inspect platform container ${containerId}`,
    );
    const listItem =
      (await this.findContainerByIdOrName(containerId)) ??
      platformContainerFromInspect(inspect);
    const [images, networks] = await Promise.all([
      this.engine
        .read(() => this.engine.docker.listImages({ all: true }), 'List images')
        .then((items) => items.map((item) => platformImageFromSummary(item))),
      this.engine
        .read(() => this.engine.docker.listNetworks(), 'List networks')
        .then((items) =>
          items.map((item) => platformNetworkFromSummary(item as never)),
        ),
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
      output: await this.lifecycle.getContainerLogs(containerId, tail),
    };
  }

  getPlatformContainerStats(containerId: string) {
    return this.resources.getContainerResourceUsage(containerId);
  }

  async stopPlatformContainer(
    containerId: string,
    admit: AdmitPlatformContainerChange,
  ) {
    const target = await this.resolvePlatformChangeTarget(containerId);
    await admit(target, () => this.lifecycle.stopContainer(target.id));
    return { id: containerId, stopped: true };
  }

  async removePlatformContainer(
    containerId: string,
    force: boolean,
    admit: AdmitPlatformContainerChange,
  ) {
    const target = await this.resolvePlatformChangeTarget(containerId);
    await admit(target, () =>
      this.lifecycle.removeContainer(target.id, { force }),
    );
    return { id: containerId, removed: true };
  }

  private async findContainerByIdOrName(idOrName: string) {
    const containers = await this.engine.read(
      () => this.engine.docker.listContainers({ all: true }),
      `Find platform container ${idOrName}`,
    );
    const dockerName = `/${idOrName}`;
    const found = containers.find(
      (container) =>
        container.Id === idOrName ||
        container.Id.startsWith(idOrName) ||
        container.Names.includes(dockerName),
    );
    return found ? platformContainerFromInfo(found) : null;
  }

  private async resolvePlatformChangeTarget(containerId: string) {
    const inspect = await this.lifecycle.inspectContainer(containerId);
    const hostname = this.engine.orchestratorHostname;
    if (
      inspect.Id.startsWith(hostname) ||
      inspect.Config?.Hostname === hostname
    ) {
      throw new ConflictException(
        'The orchestrator container cannot stop or remove itself.',
      );
    }
    const labels = inspect.Config?.Labels;
    return {
      id: inspect.Id,
      applicationId:
        labels?.['com.rebroid.managed'] === 'true'
          ? labels['com.rebroid.application-id'] || null
          : null,
    };
  }
}
