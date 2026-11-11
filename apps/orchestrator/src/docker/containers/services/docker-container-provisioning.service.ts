import { ConflictException, Injectable } from '@nestjs/common';
import { DockerEngineService } from '../../docker-engine.service';
import { ApplicationContainerSpec } from '../../docker.types';
import { parseCommandLine } from '@rebroid/android-application-core/redroid-runtime';
import { DockerImageRuntimeService } from '../../images/services/docker-image-runtime.service';
import { DockerContainerLifecycleService } from './docker-container-lifecycle.service';
import { withHostTimezoneEnv } from '../../utils/docker-container-env.utils';
import type { DockerContainerProvisioningPort } from '../../contracts/docker-container-provisioning.port';

import {
  dockerDeviceMappingsMatch,
  parseDockerDeviceMappings,
  type DockerDeviceMapping,
} from '../../contracts/docker-device-mapping';

@Injectable()
export class DockerContainerProvisioningService implements DockerContainerProvisioningPort {
  constructor(
    private readonly engine: DockerEngineService,
    private readonly images: DockerImageRuntimeService,
    private readonly lifecycle: DockerContainerLifecycleService,
  ) {}

  async createApplicationContainer(spec: ApplicationContainerSpec) {
    await this.images.ensureImage(spec.image);

    const existing = await this.lifecycle.findContainerByName(
      spec.containerName,
      spec.applicationId,
    );
    if (existing) {
      return this.reuseExistingContainer(existing.Id, spec);
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

    if (spec.persistentData) {
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
      const cpuPeriod = 100_000;

      hostConfig.CpuPeriod = cpuPeriod;
      hostConfig.CpuQuota = Math.max(
        1,
        Math.trunc(spec.cpuLimitCpus * cpuPeriod),
      );
      hostConfig.CpuShares = Math.max(2, Math.trunc(spec.cpuLimitCpus * 1024));
    }

    if (spec.securityOptions?.length) {
      hostConfig.SecurityOpt = spec.securityOptions;
    }

    const requiredDevices = parseDockerDeviceMappings(spec.devices);
    const optionalDevices = parseDockerDeviceMappings(spec.optionalDevices);
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
        spec.applicationId,
      );
      if (duplicate) {
        return this.reuseExistingContainer(duplicate.Id, spec);
      }

      throw error;
    }
  }

  private async createContainer(
    spec: ApplicationContainerSpec,
    hostConfig: import('dockerode').HostConfig,
  ) {
    return this.engine.mutate(
      () =>
        this.engine.docker.createContainer({
          Image: spec.image,
          name: spec.containerName,
          Cmd: Array.isArray(spec.containerArgs)
            ? spec.containerArgs
            : parseCommandLine(spec.containerArgs),
          Env: withHostTimezoneEnv([
            `ADB_TCP_PORT=${spec.adbPort}`,
            `ANDROID_ADB_SERVER_PORT=${spec.adbPort}`,
            `PERSIST_ADB_TCP_PORT=${spec.adbPort}`,
          ]),
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
        }),
      `Create application container ${spec.containerName}`,
    );
  }

  private async reuseExistingContainer(
    containerId: string,
    spec: ApplicationContainerSpec,
  ) {
    if (spec.requireMatchingConfiguration) {
      const inspect = await this.lifecycle.inspectContainer(containerId);
      const command = inspect.Config.Cmd ?? [];
      const expected = Array.isArray(spec.containerArgs)
        ? spec.containerArgs
        : (parseCommandLine(spec.containerArgs) ?? []);
      const cgroupnsMode = (inspect.HostConfig as { CgroupnsMode?: string })
        .CgroupnsMode;
      if (
        command.length !== expected.length ||
        !expected.every((arg, index) => arg === command[index]) ||
        (spec.cgroupnsMode?.trim() &&
          cgroupnsMode !== spec.cgroupnsMode.trim()) ||
        !dockerDeviceMappingsMatch(
          (inspect.HostConfig.Devices ?? []) as DockerDeviceMapping[],
          parseDockerDeviceMappings(spec.devices),
          parseDockerDeviceMappings(spec.optionalDevices),
        )
      ) {
        throw new ConflictException(
          'An existing runtime container has a different configuration. Recreate the stopped application runtime and try again.',
        );
      }
    }
    return this.engine.docker.getContainer(containerId);
  }

  private applyDevices(
    hostConfig: import('dockerode').HostConfig,
    requiredDevices: DockerDeviceMapping[],
    optionalDevices: DockerDeviceMapping[],
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
    optionalDevices: DockerDeviceMapping[],
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
