import { Injectable } from '@nestjs/common';
import { ApplicationProfileMode } from '../../../android-apps/application-profile-mode';
import { DockerEngineService } from '../../docker-engine.service';
import { ApplicationContainerSpec } from '../../docker.types';
import { parseCommandLine } from '../../docker.utils';
import { DockerImageRuntimeService } from '../../images/services/docker-image-runtime.service';
import { DockerContainerLifecycleService } from './docker-container-lifecycle.service';

const deviceMappingFromString = (value: string) => {
  const [hostPath, containerPath = hostPath, permissions = 'rwm'] = value
    .split(':')
    .map((part) => part.trim());

  if (!hostPath || !containerPath) {
    return null;
  }

  return {
    PathOnHost: hostPath,
    PathInContainer: containerPath,
    CgroupPermissions: permissions || 'rwm',
  };
};

type DeviceMapping = NonNullable<ReturnType<typeof deviceMappingFromString>>;

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

    const requiredDevices = this.deviceMappings(spec.devices);
    const optionalDevices = this.deviceMappings(spec.optionalDevices);
    this.applyDevices(hostConfig, requiredDevices, optionalDevices);

    if (spec.cgroupnsMode?.trim()) {
      (
        hostConfig as import('dockerode').HostConfig & {
          CgroupnsMode?: string;
        }
      ).CgroupnsMode = spec.cgroupnsMode.trim();
    }

    try {
      return await this.createContainer(spec, hostConfig);
    } catch (error) {
      if (
        optionalDevices.length > 0 &&
        this.isMissingOptionalDeviceError(error, optionalDevices)
      ) {
        this.applyDevices(hostConfig, requiredDevices, []);
        return this.createContainer(spec, hostConfig);
      }

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

  private async createContainer(
    spec: ApplicationContainerSpec,
    hostConfig: import('dockerode').HostConfig,
  ) {
    return this.engine.docker.createContainer({
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
  }

  private deviceMappings(devices: string[] | undefined) {
    return (devices ?? [])
      .map(deviceMappingFromString)
      .filter((device): device is DeviceMapping => Boolean(device));
  }

  private applyDevices(
    hostConfig: import('dockerode').HostConfig,
    requiredDevices: DeviceMapping[],
    optionalDevices: DeviceMapping[],
  ) {
    const devices = [...requiredDevices, ...optionalDevices];
    if (devices.length) {
      hostConfig.Devices = devices;
      return;
    }

    delete hostConfig.Devices;
  }

  private isMissingOptionalDeviceError(
    error: unknown,
    optionalDevices: DeviceMapping[],
  ) {
    const message = this.engine.errorMessage(error).toLowerCase();
    return optionalDevices.some(
      (device) =>
        message.includes(device.PathOnHost.toLowerCase()) &&
        (message.includes('no such file') ||
          message.includes('not found') ||
          message.includes('stat')),
    );
  }
}
