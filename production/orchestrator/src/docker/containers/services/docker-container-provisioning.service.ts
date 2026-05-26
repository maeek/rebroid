import { Injectable } from '@nestjs/common';
import { ApplicationProfileMode } from '../../../android-apps/application-profile-mode';
import { DockerEngineService } from '../../docker-engine.service';
import { ApplicationContainerSpec } from '../../docker.types';
import { parseCommandLine } from '../../docker.utils';
import { DockerImageRuntimeService } from '../../images/services/docker-image-runtime.service';
import { DockerContainerLifecycleService } from './docker-container-lifecycle.service';

@Injectable()
export class DockerContainerProvisioningService {
  constructor(
    private readonly engine: DockerEngineService,
    private readonly images: DockerImageRuntimeService,
    private readonly lifecycle: DockerContainerLifecycleService,
  ) {}

  async createApplicationContainer(spec: ApplicationContainerSpec) {
    await this.images.ensureImage(spec.image);

    const existing = await this.lifecycle.findContainerByName(
      spec.containerName,
    );
    if (existing) {
      return this.engine.docker.getContainer(existing.Id);
    }

    const hostConfig: import('dockerode').HostConfig = {
      NetworkMode: spec.networkName,
      Privileged: spec.privileged,
      PublishAllPorts: false,
      AutoRemove: false,
      RestartPolicy: {
        Name: 'no',
      },
    };

    if (spec.profileMode === ApplicationProfileMode.Persistent) {
      hostConfig.Mounts = [
        {
          Type: 'volume',
          Source: spec.volumeName,
          Target: spec.dataMountPath,
        },
      ];
    }

    if (spec.memoryLimitMb) {
      hostConfig.Memory = spec.memoryLimitMb * 1024 * 1024;
    }

    if (spec.cpuLimitCpus) {
      hostConfig.NanoCpus = Math.trunc(spec.cpuLimitCpus * 1_000_000_000);
    }

    if (spec.securityOptions?.length) {
      hostConfig.SecurityOpt = spec.securityOptions;
    }

    try {
      return await this.engine.docker.createContainer({
        Image: spec.image,
        name: spec.containerName,
        Cmd: parseCommandLine(spec.containerArgs),
        Env: [
          `ADB_TCP_PORT=${spec.adbPort}`,
          `ANDROID_ADB_SERVER_PORT=${spec.adbPort}`,
          `PERSIST_ADB_TCP_PORT=${spec.adbPort}`,
        ],
        ExposedPorts: {
          [`${spec.adbPort}/tcp`]: {},
        },
        Labels: this.engine.labels(spec.applicationId, 'runtime'),
        HostConfig: hostConfig,
        NetworkingConfig: {
          EndpointsConfig: {
            [spec.networkName]: {},
          },
        },
      });
    } catch (error) {
      if (!this.engine.isResourceAlreadyExists(error)) {
        throw error;
      }

      const duplicate = await this.lifecycle.findContainerByName(
        spec.containerName,
      );
      if (duplicate) {
        return this.engine.docker.getContainer(duplicate.Id);
      }

      throw error;
    }
  }
}
