import type Dockerode from 'dockerode';

export const DOCKER_NETWORK_RUNTIME = Symbol('DOCKER_NETWORK_RUNTIME');

export interface DockerNetworkRuntimePort {
  createIsolatedNetwork(
    applicationId: string,
    networkName: string,
  ): Promise<Dockerode.Network>;
  connectOrchestratorToNetwork(networkName: string): Promise<void>;
  getContainerIpOnNetwork(
    containerId: string,
    networkName: string,
  ): Promise<string | null>;
  getContainerIp(
    containerId: string,
    networkName: string,
  ): Promise<string | null>;
  getNetworkGateway(networkName: string): Promise<string | null>;
  getOrchestratorIp(networkName: string): Promise<string | null>;
  connectContainerToNetwork(
    containerId: string,
    networkName: string,
  ): Promise<void>;
  disconnectContainerFromNetwork(
    containerId: string,
    networkName: string,
  ): Promise<void>;
  removeNetwork(networkName: string): Promise<void>;
  listNetworkContainerIds(networkName: string): Promise<string[]>;
}
