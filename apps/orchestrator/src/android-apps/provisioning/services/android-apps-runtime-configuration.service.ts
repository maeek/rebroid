import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  parseCommandLine,
  isManagedRedroidGpuArg,
  redroidGpuModeArgKey,
  redroidGpuNodeArgKey,
  type AndroidRenderingSettings,
} from '@rebroid/android-application-core/redroid-runtime';
import { getErrorMessage } from '../../../common/error-message';
import { RedroidRuntimeConfigService } from '../../../config/redroid-runtime-config.service';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../../docker/contracts/docker-container-lifecycle.port';
import {
  dockerDeviceMappingKey,
  dockerDeviceMappingsMatch,
  parseDockerDeviceMapping,
  parseDockerDeviceMappings,
  type DockerDeviceMapping,
} from '../../../docker/contracts/docker-device-mapping';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import { SettingsService } from '../../../settings/settings.service';
import type { AndroidApplication } from '../../android-application.entity';

interface RuntimeConfiguration {
  containerArgs: string | string[] | null;
  devices: string[];
  optionalDevices: string[];
  rendering: AndroidRenderingSettings | null;
}

@Injectable()
export class AndroidAppsRuntimeConfigurationService {
  constructor(
    private readonly config: RedroidRuntimeConfigService,
    private readonly settings: SettingsService,
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly lifecycle: DockerContainerLifecyclePort,
    private readonly networkPolicy: NetworkPolicyService,
  ) {}

  async resolve(app: AndroidApplication): Promise<RuntimeConfiguration> {
    const devices = [...this.config.devices];
    const optionalDevices = [...this.config.optionalDevices];
    if (app.runtimeKind !== 'redroid') {
      return {
        containerArgs: app.containerArgs,
        devices,
        optionalDevices,
        rendering: null,
      };
    }

    const saved = await this.settings.readAndroidRendering();
    const renderDevice = saved.mode === 'host' ? saved.renderDevice : null;
    const originalArgs = parseCommandLine(app.containerArgs) ?? [];
    const renderingIndex = originalArgs.findIndex(isManagedRedroidGpuArg);
    const containerArgs = originalArgs.filter(
      (arg) => !isManagedRedroidGpuArg(arg),
    );
    const renderingArgs = [
      `${redroidGpuModeArgKey}=${renderDevice ? 'host' : 'guest'}`,
    ];
    if (renderDevice) {
      const requiredMapping = `${renderDevice}:${renderDevice}:rwm`;
      this.removeDuplicateMapping(devices, renderDevice, requiredMapping);
      this.removeDuplicateMapping(
        optionalDevices,
        renderDevice,
        requiredMapping,
      );
      devices.push(requiredMapping);
      renderingArgs.push(`${redroidGpuNodeArgKey}=${renderDevice}`);
    }
    containerArgs.splice(
      renderingIndex < 0 ? 0 : renderingIndex,
      0,
      ...renderingArgs,
    );
    return {
      containerArgs,
      devices,
      optionalDevices,
      rendering: { mode: saved.mode, renderDevice },
    };
  }

  async removeIfConfigurationChanged(
    app: AndroidApplication,
    configuration: RuntimeConfiguration,
  ) {
    const containerId = app.containerId;
    if (!containerId || !configuration.rendering) return false;
    const inspect = await this.lifecycle.inspectContainer(containerId);
    const desiredArgs = Array.isArray(configuration.containerArgs)
      ? configuration.containerArgs.filter(isManagedRedroidGpuArg)
      : [];
    const currentArgs = (inspect.Config.Cmd ?? []).filter(
      isManagedRedroidGpuArg,
    );
    const cgroupnsMode = (inspect.HostConfig as { CgroupnsMode?: string })
      .CgroupnsMode;
    const expectedCgroupnsMode = this.config.cgroupnsMode?.trim();
    if (
      currentArgs.length === desiredArgs.length &&
      desiredArgs.every((argument) => currentArgs.includes(argument)) &&
      (!expectedCgroupnsMode || cgroupnsMode === expectedCgroupnsMode) &&
      dockerDeviceMappingsMatch(
        (inspect.HostConfig.Devices ?? []) as DockerDeviceMapping[],
        parseDockerDeviceMappings(configuration.devices),
        parseDockerDeviceMappings(configuration.optionalDevices),
      )
    )
      return false;

    if (inspect.State.Running) {
      throw new ConflictException(
        'Stop the application before applying the new runtime configuration.',
      );
    }
    await this.lifecycle.removeContainer(containerId, {
      applicationId: app.id,
      force: false,
      removeVolumes: false,
    });
    await this.networkPolicy.remove(app, containerId);
    return true;
  }

  explainDeviceError(error: unknown, renderDevice: string | null | undefined) {
    if (renderDevice && getErrorMessage(error).includes(renderDevice)) {
      return new Error(
        `Docker could not map GPU render device ${renderDevice}. Check the device on the Docker host or select Software in Android GPU rendering settings.`,
        { cause: error },
      );
    }
    return error;
  }

  private removeDuplicateMapping(
    devices: string[],
    renderDevice: string,
    requiredMapping: string,
  ) {
    for (let index = devices.length - 1; index >= 0; index -= 1) {
      const device = parseDockerDeviceMapping(devices[index]);
      if (device?.PathInContainer !== renderDevice) continue;
      if (dockerDeviceMappingKey(device) !== requiredMapping) {
        throw new ConflictException(
          `The GPU render device ${renderDevice} conflicts with a deployment device mapping. Correct the mapping or select Software.`,
        );
      }
      devices.splice(index, 1);
    }
  }
}
