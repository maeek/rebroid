import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationProfileMode } from '../android-apps/contracts/application-profile-mode';
import { dockerSafeName } from '../common/docker-name';
import {
  DOCKER_NETWORK_RUNTIME,
  type DockerNetworkRuntimePort,
} from '../docker/contracts/docker-network-runtime.port';
import {
  DOCKER_RESOURCE_RUNTIME,
  type DockerResourceRuntimePort,
} from '../docker/contracts/docker-resource-runtime.port';

export interface IsolatedRuntimeNames {
  containerName: string;
  networkName: string;
  volumeName: string;
}

@Injectable()
export class NetworkIsolationService {
  constructor(
    private readonly config: ConfigService,
    @Inject(DOCKER_NETWORK_RUNTIME)
    private readonly networks: DockerNetworkRuntimePort,
    @Inject(DOCKER_RESOURCE_RUNTIME)
    private readonly resources: DockerResourceRuntimePort,
  ) {}

  /**
   * Derives stable Docker resource names from the app id, name, and optional profile.
   * Only the first eight id characters are used to keep names deterministic and short.
   */
  namesFor(
    applicationId: string,
    name: string,
    profileName?: string | null,
  ): IsolatedRuntimeNames {
    const prefix = this.config.getOrThrow<string>('app.docker.resourcePrefix');
    const safeName = dockerSafeName(name, 'android-app');
    const safeProfileName = profileName
      ? `-${dockerSafeName(profileName, 'profile')}`
      : '';
    const suffix = applicationId.slice(0, 8);

    return {
      containerName: `${prefix}-runtime-${safeName}-${suffix}`,
      networkName: `${prefix}-net-${safeName}-${suffix}`,
      volumeName: `${prefix}-data-${safeName}${safeProfileName}-${suffix}`,
    };
  }

  /**
   * Creates the volume and isolated network needed for a managed runtime.
   * The orchestrator is attached so it can still reach the app over that network.
   */
  async createBoundary(applicationId: string, names: IsolatedRuntimeNames) {
    await this.createRuntimeBoundary(
      applicationId,
      ApplicationProfileMode.Persistent,
      names,
    );
  }

  /**
   * Creates the isolated runtime network and only provisions persistent storage when required.
   */
  async createRuntimeBoundary(
    applicationId: string,
    profileMode: ApplicationProfileMode,
    names: Pick<IsolatedRuntimeNames, 'networkName' | 'volumeName'>,
  ) {
    if (profileMode === ApplicationProfileMode.Persistent) {
      await this.resources.createVolume(applicationId, names.volumeName);
    }
    await this.networks.createIsolatedNetwork(applicationId, names.networkName);
    await this.connectOrchestrator(names.networkName);
  }

  async connectOrchestrator(networkName: string) {
    await this.networks.connectOrchestratorToNetwork(networkName);
  }

  /**
   * Removes the network boundary resources for an application profile.
   */
  async removeBoundary(
    names: Pick<IsolatedRuntimeNames, 'networkName' | 'volumeName'>,
  ) {
    await Promise.all([
      this.networks.removeNetwork(names.networkName),
      this.resources.removeVolume(names.volumeName),
    ]);
  }
}
