import type { DockerNetworkRuntimeService } from '../networks/services/docker-network-runtime.service';

export const DOCKER_NETWORK_RUNTIME = Symbol('DOCKER_NETWORK_RUNTIME');

export type DockerNetworkRuntimePort = Pick<
  DockerNetworkRuntimeService,
  keyof DockerNetworkRuntimeService
>;
