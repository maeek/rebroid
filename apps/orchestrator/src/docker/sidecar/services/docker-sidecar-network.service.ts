import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DockerOperationOptions } from '../../contracts/docker-operation-options';
import type { DockerSidecarAttachmentTimings } from '../../contracts/docker-sidecar.port';
import type Dockerode from 'dockerode';
import { DockerEngineService } from '../../docker-engine.service';
import { ViewerTargetStatus } from '../../docker.types';
import { DockerNetworkRuntimeService } from '../../networks/services/docker-network-runtime.service';

@Injectable()
export class DockerSidecarNetworkService {
  private readonly logger = new Logger(DockerSidecarNetworkService.name);
  private readonly displaySidecarPlatformNetwork?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly engine: DockerEngineService,
    private readonly networks: DockerNetworkRuntimeService,
  ) {
    this.displaySidecarPlatformNetwork = this.config.get<string>(
      'app.displaySidecar.platformNetwork',
    );
  }

  async ensureOnNetwork(
    sidecar: Dockerode.Container,
    networkName: string,
    inspect?: Dockerode.ContainerInspectInfo,
    timings?: DockerSidecarAttachmentTimings,
    options?: DockerOperationOptions,
  ): Promise<ViewerTargetStatus> {
    if (timings) {
      timings.sidecarContainerId = inspect?.Id ?? sidecar.id;
      if (inspect) {
        timings.sidecarNetworkCountBefore = Object.keys(
          inspect.NetworkSettings?.Networks ?? {},
        ).length;
        const ports = inspect.NetworkSettings?.Ports;
        if (ports) {
          const published = Object.values(ports).filter(
            (bindings) => bindings && bindings.length > 0,
          );
          timings.sidecarPublishedPortCount = published.length;
          timings.sidecarPublishedBindingCount = published.reduce(
            (count, bindings) => count + bindings.length,
            0,
          );
        }
      }
    }
    const inspectStartedAt = performance.now();
    const currentIp = await this.getContainerIpOnNetwork(
      sidecar,
      networkName,
      inspect,
      options,
    ).finally(() => {
      if (timings)
        timings.networkInspectMs += Math.round(
          performance.now() - inspectStartedAt,
        );
    });
    if (currentIp) {
      return this.sidecarNetworkStatus(networkName, currentIp);
    }

    await this.networks.connectContainerToNetwork(
      sidecar.id,
      networkName,
      timings,
      options,
    );
    const verifyStartedAt = performance.now();
    const sidecarIp = await this.getContainerIpOnNetwork(
      sidecar,
      networkName,
    ).finally(() => {
      if (timings)
        timings.networkInspectMs += Math.round(
          performance.now() - verifyStartedAt,
        );
    });
    if (!sidecarIp) {
      return {
        configured: true,
        connected: false,
        message: `Display sidecar could not be verified on ${networkName}.`,
        error: {
          code: 'adb_unreachable',
          message: `Display sidecar is not attached to ${networkName}; ADB target DNS will not resolve.`,
          retryable: true,
          exitCode: null,
          command: null,
          stdout: null,
          stderr: null,
        },
      };
    }

    return this.sidecarNetworkStatus(networkName, sidecarIp);
  }

  async detachFromNetwork(sidecar: Dockerode.Container, networkName: string) {
    await this.networks.disconnectContainerFromNetwork(sidecar.id, networkName);
  }

  async getSidecarIp(
    sidecar: Dockerode.Container,
    networkName: string,
    inspect?: Dockerode.ContainerInspectInfo,
  ) {
    try {
      return await this.getContainerIpOnNetwork(sidecar, networkName, inspect);
    } catch {
      return null;
    }
  }

  async cleanupStaleNetworks(sidecar: Dockerode.Container) {
    const inspect = await this.engine.read(
      () => sidecar.inspect(),
      'Inspect display sidecar networks',
    );
    const networkNames = Object.keys(inspect.NetworkSettings?.Networks ?? {});
    const staleNetworkNames = networkNames.filter((networkName) =>
      this.isStaleSidecarNetwork(networkName),
    );

    if (!staleNetworkNames.length) {
      return;
    }

    await Promise.all(
      staleNetworkNames.map((networkName) =>
        this.networks.disconnectContainerFromNetwork(sidecar.id, networkName),
      ),
    );
    this.logger.log(
      `Detached display sidecar from stale networks: ${staleNetworkNames.join(', ')}`,
    );
  }

  private async getContainerIpOnNetwork(
    sidecar: Dockerode.Container,
    networkName: string,
    currentInspect?: Dockerode.ContainerInspectInfo,
    options?: DockerOperationOptions,
  ) {
    options?.signal?.throwIfAborted();
    options?.deadline?.throwIfExpired();
    const inspect =
      currentInspect ??
      (await this.engine.read(
        () => sidecar.inspect(),
        `Inspect display sidecar on network ${networkName}`,
        options,
      ));
    return inspect.NetworkSettings.Networks?.[networkName]?.IPAddress || null;
  }

  private sidecarNetworkStatus(
    networkName: string,
    ipAddress: string,
  ): ViewerTargetStatus {
    return {
      configured: true,
      connected: true,
      message: `Display sidecar is attached to ${networkName} as ${ipAddress}.`,
      error: null,
    };
  }

  private isStaleSidecarNetwork(networkName: string) {
    if (networkName === this.displaySidecarPlatformNetwork) {
      return false;
    }

    return networkName.startsWith(`${this.engine.resourcePrefix}-net-`);
  }
}
