import { Injectable } from '@nestjs/common';
import { platformContainerFromInfo } from '../../containers/utils/platform-container.utils';
import { DockerEngineService } from '../../docker-engine.service';
import { PlatformNetwork, PlatformNetworkDetails } from '../../docker.types';
import {
  platformNetworkFromInspect,
  platformNetworkFromSummary,
} from '../utils/platform-network.utils';
import type { DockerPlatformNetworksPort } from '../../contracts/docker-platform-networks.port';

@Injectable()
export class DockerPlatformNetworksService implements DockerPlatformNetworksPort {
  constructor(private readonly engine: DockerEngineService) {}

  async listPlatformNetworks(): Promise<PlatformNetwork[]> {
    const networks = await this.engine.read(
      () => this.engine.docker.listNetworks(),
      'List platform networks',
    );
    return networks.map((network) =>
      platformNetworkFromSummary(network as never),
    );
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
    const [networks, containers] = await Promise.all([
      this.listPlatformNetworks(),
      this.engine
        .read(
          () => this.engine.docker.listContainers({ all: true }),
          'List containers for platform network details',
        )
        .then((items) => items.map((item) => platformContainerFromInfo(item))),
    ]);
    const listItem =
      networks.find(
        (item) => item.id === inspect.Id || item.name === inspect.Name,
      ) ?? platformNetworkFromInspect(inspect);

    return {
      network: listItem,
      inspect,
      relatedContainers: containers.filter((container) =>
        container.networks.includes(listItem.name),
      ),
    };
  }
}
