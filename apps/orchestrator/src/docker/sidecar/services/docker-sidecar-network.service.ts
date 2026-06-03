import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Dockerode from 'dockerode';
import { DockerEngineService } from '../../docker-engine.service';
import { ViewerTargetStatus } from '../../docker.types';
import { DockerNetworkRuntimeService } from '../../networks/services/docker-network-runtime.service';

interface CachedSidecarNetwork {
  containerId: string;
  ipAddress: string;
  expiresAt: number;
}

@Injectable()
export class DockerSidecarNetworkService {
  private readonly logger = new Logger(DockerSidecarNetworkService.name);
  private readonly displaySidecarPlatformNetwork?: string;
  private readonly sidecarNetworks = new Map<string, CachedSidecarNetwork>();

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
  ): Promise<ViewerTargetStatus> {
    const cached = this.sidecarNetworks.get(networkName);
    if (cached?.containerId === sidecar.id && cached.expiresAt > Date.now()) {
      return this.sidecarNetworkStatus(networkName, cached.ipAddress);
    }

    const currentIp = await this.getContainerIpOnNetwork(sidecar, networkName);
    if (currentIp) {
      return this.cacheSidecarNetwork(sidecar.id, networkName, currentIp);
    }

    await this.networks.connectContainerToNetwork(sidecar.id, networkName);
    const sidecarIp = await this.getContainerIpOnNetwork(sidecar, networkName);
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

    return this.cacheSidecarNetwork(sidecar.id, networkName, sidecarIp);
  }

  async detachFromNetwork(sidecar: Dockerode.Container, networkName: string) {
    this.sidecarNetworks.delete(networkName);
    await this.networks.disconnectContainerFromNetwork(sidecar.id, networkName);
  }

  async getSidecarIp(sidecar: Dockerode.Container, networkName: string) {
    try {
      return await this.getContainerIpOnNetwork(sidecar, networkName);
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
    staleNetworkNames.forEach((networkName) =>
      this.sidecarNetworks.delete(networkName),
    );

    this.logger.log(
      `Detached display sidecar from stale networks: ${staleNetworkNames.join(', ')}`,
    );
  }

  private async getContainerIpOnNetwork(
    sidecar: Dockerode.Container,
    networkName: string,
  ) {
    const inspect = await this.engine.read(
      () => sidecar.inspect(),
      `Inspect display sidecar on network ${networkName}`,
    );
    return inspect.NetworkSettings.Networks?.[networkName]?.IPAddress || null;
  }

  private cacheSidecarNetwork(
    containerId: string,
    networkName: string,
    ipAddress: string,
  ) {
    this.sidecarNetworks.set(networkName, {
      containerId,
      ipAddress,
      expiresAt: Date.now() + 30_000,
    });
    return this.sidecarNetworkStatus(networkName, ipAddress);
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
