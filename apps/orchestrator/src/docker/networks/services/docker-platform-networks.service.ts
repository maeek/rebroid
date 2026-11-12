import { Injectable } from '@nestjs/common';
import { DockerEngineService } from '../../docker-engine.service';
import { PlatformNetwork, PlatformNetworkDetails } from '../../docker.types';
import { DockerInventoryService } from '../../inventory/docker-inventory.service';
import { platformNetworkFromInspect } from '../utils/platform-network.utils';
import type { DockerPlatformNetworksPort } from '../../contracts/docker-platform-networks.port';

@Injectable()
export class DockerPlatformNetworksService implements DockerPlatformNetworksPort {
  constructor(
    private readonly engine: DockerEngineService,
    private readonly inventory: DockerInventoryService,
  ) {}

  listPlatformNetworks(): Promise<PlatformNetwork[]> {
    return this.inventory.listNetworks();
  }

  async removePlatformNetwork(networkId: string) {
    await this.engine.mutate(
      () => this.engine.docker.getNetwork(networkId).remove(),
      `Remove platform network ${networkId}`,
    );
    return { id: networkId, removed: true };
  }

  async getPlatformNetworkDetails(
    networkId: string,
  ): Promise<PlatformNetworkDetails> {
    const network = this.engine.docker.getNetwork(networkId);
    const inspect = await this.engine.read(
      () => network.inspect(),
      `Inspect platform network ${networkId}`,
    );
    const containers = await this.inventory.listContainers();
    const listItem = platformNetworkFromInspect(inspect);
    const memberIds = inspect.Containers && new Set(listItem.containers);

    return {
      network: listItem,
      inspect,
      relatedContainers: containers.filter((container) =>
        memberIds
          ? memberIds.has(container.id)
          : container.networks.includes(listItem.name),
      ),
    };
  }
}
