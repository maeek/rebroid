import type { PlatformNetwork, PlatformNetworkDetails } from '../docker.types';

export const DOCKER_PLATFORM_NETWORKS = Symbol('DOCKER_PLATFORM_NETWORKS');

export interface DockerPlatformNetworksPort {
  listPlatformNetworks(): Promise<PlatformNetwork[]>;
  removePlatformNetwork(
    networkId: string,
  ): Promise<{ id: string; removed: boolean }>;
  getPlatformNetworkDetails(networkId: string): Promise<PlatformNetworkDetails>;
}
