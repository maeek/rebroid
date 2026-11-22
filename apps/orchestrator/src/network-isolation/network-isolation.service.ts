import { Inject, Injectable } from '@nestjs/common';
import {
  DOCKER_NETWORK_RUNTIME,
  type DockerNetworkRuntimePort,
} from '../docker/contracts/docker-network-runtime.port';
import {
  DOCKER_RESOURCE_RUNTIME,
  type DockerResourceRuntimePort,
} from '../docker/contracts/docker-resource-runtime.port';

@Injectable()
export class NetworkIsolationService {
  constructor(
    @Inject(DOCKER_NETWORK_RUNTIME)
    private readonly networks: DockerNetworkRuntimePort,
    @Inject(DOCKER_RESOURCE_RUNTIME)
    private readonly resources: DockerResourceRuntimePort,
  ) {}

  /**
   * Creates the isolated runtime network and only provisions persistent storage when required.
   */
  async createRuntimeBoundary(
    applicationId: string,
    persistentData: boolean,
    names: { networkName: string; volumeName: string },
  ) {
    if (persistentData) {
      await this.resources.createVolume(applicationId, names.volumeName);
    }
    await this.networks.createIsolatedNetwork(applicationId, names.networkName);
    await this.connectOrchestrator(names.networkName);
  }

  async connectOrchestrator(networkName: string) {
    await this.networks.connectOrchestratorToNetwork(networkName);
  }
}
