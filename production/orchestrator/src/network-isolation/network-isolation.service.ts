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

  async createBoundary(applicationId: string, names: IsolatedRuntimeNames) {
    await this.docker.createVolume(applicationId, names.volumeName);
    await this.docker.createIsolatedNetwork(applicationId, names.networkName);
    await this.docker.connectOrchestratorToNetwork(names.networkName);
  }

  async removeBoundary(
    names: Pick<IsolatedRuntimeNames, 'networkName' | 'volumeName'>,
  ) {
    await this.docker.removeNetwork(names.networkName);
    await this.docker.removeVolume(names.volumeName);
  }
}
