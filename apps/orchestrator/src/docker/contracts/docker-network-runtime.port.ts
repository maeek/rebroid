import type Dockerode from 'dockerode';
import type { DockerOperationOptions } from './docker-operation-options';

export interface DockerNetworkConnectObservation {
  requestId: string;
  containerId: string;
  networkName: string;
  transport: 'local-socket' | 'remote';
  dispatchedAt: string;
  settledAt?: string;
  outcome: 'pending' | 'fulfilled' | 'rejected';
}

export interface DockerNetworkAttachmentTimings {
  dockerMutationQueueMs: number;
  networkConnectMs: number;
  networkConvergenceMs: number;
  networkConnect?: DockerNetworkConnectObservation;
}

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
  getManagedIpv4Subnet(
    applicationId: string,
    networkName: string,
  ): Promise<string>;
  getOrchestratorIp(networkName: string): Promise<string | null>;
  connectContainerToNetwork(
    containerId: string,
    networkName: string,
    timings?: DockerNetworkAttachmentTimings,
    options?: DockerOperationOptions,
  ): Promise<void>;
  disconnectContainerFromNetwork(
    containerId: string,
    networkName: string,
  ): Promise<void>;
  removeNetwork(networkName: string, applicationId?: string): Promise<void>;
  listNetworkContainerIds(networkName: string): Promise<string[]>;
}
