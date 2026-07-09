import type { DockerPlatformNetworksService } from '../networks/services/docker-platform-networks.service';

export const DOCKER_PLATFORM_NETWORKS = Symbol('DOCKER_PLATFORM_NETWORKS');

export type DockerPlatformNetworksPort = Pick<
  DockerPlatformNetworksService,
  keyof DockerPlatformNetworksService
>;
