import {
  BadRequestException,
  ConflictException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { DockerEngineService } from '../../docker-engine.service';
import {
  PlatformContainer,
  PlatformContainerDetails,
  PlatformContainerLog,
} from '../../docker.types';
import { platformContainerFromInspect } from '../utils/platform-container.utils';
import { DockerInventoryService } from '../../inventory/docker-inventory.service';
import { DockerContainerLifecycleService } from './docker-container-lifecycle.service';
import { DockerResourceRuntimeService } from '../../resources/services/docker-resource-runtime.service';
import type {
  AdmitPlatformContainerChange,
  DockerPlatformContainersPort,
} from '../../contracts/docker-platform-containers.port';

const maxPlatformLogLines = 1_000;
const maxPlatformLogBytes = 2 * 1024 * 1024;
const fallbackPlatformLogLines = 20;

@Injectable()
export class DockerPlatformContainersService implements DockerPlatformContainersPort {
  constructor(
    private readonly engine: DockerEngineService,
    private readonly lifecycle: DockerContainerLifecycleService,
    private readonly resources: DockerResourceRuntimeService,
    private readonly inventory: DockerInventoryService,
  ) {}

  listPlatformContainers(): Promise<PlatformContainer[]> {
    return this.inventory.listContainers();
  }

  async getPlatformContainerDetails(
    containerId: string,
  ): Promise<PlatformContainerDetails> {
    const container = this.engine.docker.getContainer(containerId);
    const inspect = await this.engine.read(
      () => container.inspect(),
      `Inspect platform container ${containerId}`,
    );
    const [containers, images, networks] = await Promise.all([
      this.inventory.listContainers(),
      this.inventory.listImages(),
      this.inventory.listNetworks(),
    ]);
    const live = platformContainerFromInspect(inspect);
    const listItem = containers.find((item) => item.id === live.id);
    const relatedImage =
      images.find((image) => image.id === inspect.Image) ??
      images.find((image) => image.repoTags.includes(live.image)) ??
      null;
    const connectedNetworks = new Map(
      Object.entries(inspect.NetworkSettings?.Networks ?? {}),
    );

    return {
      container: {
        ...(listItem ?? live),
        state: live.state,
        status: listItem?.state === live.state ? listItem.status : live.status,
        networks: live.networks,
      },
      inspect,
      relatedImage,
      relatedNetworks: networks.filter((network) => {
        const connected = connectedNetworks.get(network.name);
        return (
          connected &&
          (!connected.NetworkID || connected.NetworkID === network.id)
        );
      }),
    };
  }

  async getPlatformContainerLogs(
    containerId: string,
    tail = 500,
  ): Promise<PlatformContainerLog> {
    if (!Number.isSafeInteger(tail) || tail < 1) {
      throw new BadRequestException(
        'The log tail must be a positive whole number.',
      );
    }
    const lineLimit = Math.min(tail, maxPlatformLogLines);
    const output = await this.lifecycle
      .getBoundedContainerLogs(containerId, lineLimit, maxPlatformLogBytes)
      .catch((error: unknown) => {
        if (
          !(error instanceof PayloadTooLargeException) ||
          lineLimit <= fallbackPlatformLogLines
        )
          throw error;
        return this.lifecycle.getBoundedContainerLogs(
          containerId,
          fallbackPlatformLogLines,
          maxPlatformLogBytes,
        );
      });
    return {
      source: 'container',
      collectedAt: new Date().toISOString(),
      output,
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
