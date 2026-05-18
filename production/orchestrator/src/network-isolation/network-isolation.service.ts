import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { dockerSafeName } from '../common/docker-name';
import { DockerRuntimeService } from '../docker/docker-runtime.service';

export interface IsolatedRuntimeNames {
  containerName: string;
  networkName: string;
  volumeName: string;
}

@Injectable()
export class NetworkIsolationService {
  constructor(
    private readonly config: ConfigService,
    private readonly docker: DockerRuntimeService,
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
    await this.docker.createVolume(applicationId, names.volumeName);
    await this.docker.createIsolatedNetwork(applicationId, names.networkName);
    await this.docker.connectOrchestratorToNetwork(names.networkName);
  }

  /**
   * Removes the network boundary resources for an application profile.
   */
  async removeBoundary(
    names: Pick<IsolatedRuntimeNames, 'networkName' | 'volumeName'>,
  ) {
    await this.docker.removeNetwork(names.networkName);
    await this.docker.removeVolume(names.volumeName);
  }
}
