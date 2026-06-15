import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Dockerode from 'dockerode';
import { DockerContainerLifecycleService } from '../../containers/services/docker-container-lifecycle.service';
import { DockerEngineService } from '../../docker-engine.service';
import { ServiceHealth, ViewerTargetStatus } from '../../docker.types';
import { DockerSidecarAdbService } from './docker-sidecar-adb.service';
import { DockerSidecarApiService } from './docker-sidecar-api.service';
import { DockerSidecarImageService } from './docker-sidecar-image.service';
import { DockerSidecarNetworkService } from './docker-sidecar-network.service';
import { webrtcUdpPortBinding } from '../utils/docker-sidecar.utils';
import { withHostTimezoneEnv } from '../../utils/docker-container-env.utils';

@Injectable()
export class DockerSidecarService implements OnModuleInit {
  private readonly logger = new Logger(DockerSidecarService.name);
  private readonly displaySidecarContainerId?: string;
  private readonly displaySidecarContainerName: string;
  private readonly displaySidecarImage: string;
  private readonly displaySidecarBuildContext: string;
  private readonly displaySidecarAutoStart: boolean;
  private readonly displaySidecarPlatformNetwork?: string;
  private readonly displaySidecarPort: number;
  private readonly displaySidecarPublishedHostPort: number;
  private readonly displaySidecarWebrtcUdpPortRange: string;
  private readonly displaySidecarWebrtcIceHost: string;
  private displaySidecarLastError: string | null = null;
  private sidecarMutation = Promise.resolve();

  constructor(
    private readonly config: ConfigService,
    private readonly engine: DockerEngineService,
    private readonly lifecycle: DockerContainerLifecycleService,
    private readonly sidecarAdb: DockerSidecarAdbService,
    private readonly sidecarApi: DockerSidecarApiService,
    private readonly sidecarNetwork: DockerSidecarNetworkService,
    private readonly sidecarImages: DockerSidecarImageService,
  ) {
    this.displaySidecarContainerId = this.config.get<string>(
      'app.displaySidecar.containerId',
    );
    this.displaySidecarContainerName = this.config.getOrThrow<string>(
      'app.displaySidecar.containerName',
    );
    this.displaySidecarImage = this.config.getOrThrow<string>(
      'app.displaySidecar.image',
    );
    this.displaySidecarBuildContext = this.config.getOrThrow<string>(
      'app.displaySidecar.buildContext',
    );
    this.displaySidecarAutoStart = this.config.getOrThrow<boolean>(
      'app.displaySidecar.autoStart',
    );
    this.displaySidecarPlatformNetwork = this.config.get<string>(
      'app.displaySidecar.platformNetwork',
    );
    this.displaySidecarPort = this.config.getOrThrow<number>(
      'app.displaySidecar.port',
    );
    this.displaySidecarPublishedHostPort = this.config.getOrThrow<number>(
      'app.displaySidecar.publishedHostPort',
    );
    this.displaySidecarWebrtcUdpPortRange = this.config.getOrThrow<string>(
      'app.displaySidecar.webrtcUdpPortRange',
    );
    this.displaySidecarWebrtcIceHost = this.config.getOrThrow<string>(
      'app.displaySidecar.webrtcIceHost',
    );
  }

  private get docker() {
    return this.engine.docker;
  }

  /**
   * Starts the display sidecar lazily on module init when autostart is enabled.
   * Startup failures are logged and cached for health responses instead of crashing boot.
   */
  onModuleInit() {
    if (!this.displaySidecarAutoStart) {
      return;
    }

    void this.initializeSidecarOnStartup().catch((error) => {
      this.displaySidecarLastError = this.engine.errorMessage(error);
      this.logger.warn(
        `Display sidecar was not started automatically: ${this.displaySidecarLastError}`,
      );
    });
  }

  /**
   * Ensures the sidecar can reach the app network and then opens the ADB connection.
   */
  async prepareViewerTarget(
    networkName: string,
    adbHost: string,
    adbPort: number,
  ): Promise<ViewerTargetStatus> {
    const networkTarget = await this.ensureSidecarOnNetwork(networkName);
    if (!networkTarget.configured || !networkTarget.connected) {
      return networkTarget;
    }

    return this.connectAdb(adbHost, adbPort);
  }

  /**
   * Creates or starts the sidecar if needed, then attaches it to the app network.
   */
  async ensureSidecarOnNetwork(
    networkName: string,
  ): Promise<ViewerTargetStatus> {
    return this.queueSidecarMutation(async () => {
      const sidecar = await this.ensureSidecarUnlocked();
      if (!sidecar) {
        return this.sidecarUnavailableStatus();
      }

      return this.sidecarNetwork.ensureOnNetwork(sidecar, networkName);
    });
  }

  async detachSidecarFromNetwork(networkName: string) {
    await this.queueSidecarMutation(async () => {
      const sidecar = await this.findSidecar();
      if (!sidecar) {
        return;
      }

      await this.sidecarNetwork.detachFromNetwork(sidecar, networkName);
    });
  }

  /**
   * Runs adb connect inside the sidecar and classifies common connection failures.
   */
  async connectAdb(
    adbHost: string,
    adbPort: number,
  ): Promise<ViewerTargetStatus> {
    const sidecar = await this.ensureSidecar();
    if (!sidecar) {
      return this.sidecarUnavailableStatus();
    }

    return this.sidecarAdb.prepareTarget(sidecar.id, adbHost, adbPort);
  }

  /**
   * Returns the sidecar IP on a specific app network when it is attached.
   */
  async getSidecarIp(networkName: string) {
    const sidecar = await this.findSidecar();
    if (!sidecar) {
      return null;
    }

    return this.sidecarNetwork.getSidecarIp(sidecar, networkName);
  }

  /**
   * Reports whether the sidecar exists and is currently running.
   * Cached startup errors are surfaced when autostart failed earlier.
   */
  async health(): Promise<ServiceHealth> {
    const apiError = await this.sidecarApi.probeHealth();
    if (!apiError) {
      this.displaySidecarLastError = null;
      return {
        ok: true,
        status: 'healthy',
        message: 'Display sidecar API is responding.',
        details: {
          containerName: this.displaySidecarContainerName,
          image: this.displaySidecarImage,
          port: this.displaySidecarPort,
          publishedHostPort: this.displaySidecarPublishedHostPort || null,
        },
      };
    }

    try {
      const sidecar = await this.findSidecar();
      if (!sidecar) {
        return {
          ok: false,
          status: 'offline',
          message: this.displaySidecarAutoStart
            ? (this.displaySidecarLastError ??
              `Sidecar container ${this.displaySidecarContainerName} is not created yet.`)
            : 'Sidecar autostart is disabled.',
          details: {
            image: this.displaySidecarImage,
            containerName: this.displaySidecarContainerName,
            autoStart: this.displaySidecarAutoStart,
            publishedHostPort: this.displaySidecarPublishedHostPort || null,
          },
        };
      }

      const inspect = await this.engine.read(
        () => sidecar.inspect(),
        'Inspect display sidecar health',
      );
      const running = Boolean(inspect.State?.Running);
      const recentLogs = await this.getRecentSidecarLogs(sidecar.id);

      return {
        ok: false,
        status: 'unhealthy',
        message: running
          ? `Display sidecar container is running, but its API is not reachable: ${apiError}`
          : `Display sidecar is ${inspect.State?.Status ?? 'not running'}; exit code ${inspect.State?.ExitCode ?? 'unknown'}${inspect.State?.Error ? `; Docker error: ${inspect.State.Error}` : ''}.`,
        details: {
          containerId: inspect.Id.slice(0, 12),
          containerName: this.displaySidecarContainerName,
          image: this.displaySidecarImage,
          port: this.displaySidecarPort,
          publishedHostPort: this.displaySidecarPublishedHostPort || null,
          exitCode: inspect.State?.ExitCode ?? null,
          error: inspect.State?.Error || null,
          finishedAt: inspect.State?.FinishedAt || null,
          restartCount: inspect.RestartCount ?? null,
          recentLogs,
        },
      };
    } catch (error) {
      return {
        ok: false,
        status: 'offline',
        message: this.engine.errorMessage(error),
        details: {
          image: this.displaySidecarImage,
          containerName: this.displaySidecarContainerName,
        },
      };
    }
  }

  /** Checks the sidecar API without adding Docker inventory work to routine polling. */
  async shallowHealth(): Promise<ServiceHealth> {
    const apiError = await this.sidecarApi.probeHealth();
    if (!apiError) {
      this.displaySidecarLastError = null;
      return {
        ok: true,
        status: 'healthy',
        message: 'Display sidecar API is responding.',
      };
    }

    return {
      ok: false,
      status: 'offline',
      message: `Display sidecar API is not reachable: ${apiError}`,
    };
  }

  async listDisplaySessions() {
    return this.sidecarApi.listDisplaySessions();
  }

  async releaseDisplaySession(id: string) {
    return this.sidecarApi.releaseDisplaySession(id);
  }

  /**
   * Restarts an existing sidecar or creates it if autostart is enabled.
   */
  async repair() {
    return this.queueSidecarMutation(async () => {
      try {
        const existing = await this.findSidecar();
        if (existing) {
          await this.lifecycle.stopContainer(existing.id, 3);
          await this.lifecycle.startContainer(existing.id);
          await this.sidecarApi.waitForReady();
          await this.sidecarNetwork.cleanupStaleNetworks(existing);
          this.displaySidecarLastError = null;
          return existing.id;
        }

        const created = await this.ensureSidecarUnlocked();
        if (!created) {
          throw new ConflictException('Display sidecar autostart is disabled.');
        }

        this.displaySidecarLastError = null;
        return created.id;
      } catch (error) {
        this.displaySidecarLastError = this.engine.errorMessage(error);
        throw error;
      }
    });
  }

  /**
   * Returns a started sidecar container, creating one only when autostart is enabled.
   */
  private async ensureSidecar() {
    return this.queueSidecarMutation(() => this.ensureSidecarUnlocked());
  }

  private async ensureSidecarUnlocked() {
    const existing = await this.findSidecar();
    if (existing) {
      const inspect = await this.engine.read(
        () => existing.inspect(),
        'Inspect display sidecar before start',
      );
      if (!inspect.State?.Running) {
        await this.lifecycle.startContainer(existing.id);
        await this.sidecarApi.waitForReady();
      }
      return existing;
    }

    if (!this.displaySidecarAutoStart) {
      return null;
    }

    await this.sidecarImages.ensureImage(
      this.displaySidecarImage,
      this.displaySidecarBuildContext,
    );
    const hostConfig: Dockerode.HostConfig = {
      AutoRemove: false,
      PublishAllPorts: false,
      RestartPolicy: { Name: 'unless-stopped' },
    };

    if (this.displaySidecarPublishedHostPort > 0) {
      hostConfig.PortBindings = {
        [`${this.displaySidecarPort}/tcp`]: [
          {
            HostIp: '0.0.0.0',
            HostPort: String(this.displaySidecarPublishedHostPort),
          },
        ],
      };
    }
    const webrtcPortBinding = webrtcUdpPortBinding(
      this.displaySidecarWebrtcUdpPortRange,
    );
    if (webrtcPortBinding) {
      hostConfig.PortBindings = {
        ...(hostConfig.PortBindings ?? {}),
        ...webrtcPortBinding.portBindings,
      };
    }

    if (this.displaySidecarPlatformNetwork) {
      hostConfig.NetworkMode = this.displaySidecarPlatformNetwork;
    }

    const networkingConfig = this.displaySidecarPlatformNetwork
      ? {
          EndpointsConfig: {
            [this.displaySidecarPlatformNetwork]: {},
          },
        }
      : undefined;

    const container = await this.engine.mutate(
      () =>
        this.docker.createContainer({
          Image: this.displaySidecarImage,
          name: this.displaySidecarContainerName,
          Env: withHostTimezoneEnv([
            `PORT=${this.displaySidecarPort}`,
            ...(this.config.get<string>('app.sharedSecret')
              ? [
                  `DISPLAY_SIDECAR_SHARED_SECRET=${this.config.get<string>('app.sharedSecret')}`,
                ]
              : []),
            `DISPLAY_WEBRTC_UDP_PORT_RANGE=${this.displaySidecarWebrtcUdpPortRange}`,
            ...(this.displaySidecarWebrtcIceHost
              ? [`DISPLAY_WEBRTC_ICE_HOST=${this.displaySidecarWebrtcIceHost}`]
              : []),
          ]),
          ExposedPorts: {
            [`${this.displaySidecarPort}/tcp`]: {},
            ...(webrtcPortBinding?.exposedPorts ?? {}),
          },
          Labels: this.engine.labels('platform', 'display-sidecar'),
          HostConfig: hostConfig,
          NetworkingConfig: networkingConfig,
        }),
      `Create display sidecar ${this.displaySidecarContainerName}`,
    );
    await this.engine.mutate(
      () => container.start(),
      `Start display sidecar ${container.id}`,
    );
    await this.sidecarApi.waitForReady();
    return container;
  }

  private async initializeSidecarOnStartup() {
    return this.queueSidecarMutation(async () => {
      const sidecar = await this.ensureSidecarUnlocked();
      if (!sidecar) {
        return null;
      }

      await this.sidecarNetwork.cleanupStaleNetworks(sidecar);
      this.displaySidecarLastError = null;
      return sidecar;
    });
  }

  private queueSidecarMutation<T>(operation: () => Promise<T>) {
    const queued = this.sidecarMutation.then(operation, operation);
    this.sidecarMutation = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }

  private async getRecentSidecarLogs(containerId: string) {
    try {
      return (await this.lifecycle.getContainerLogs(containerId, 120)).trim();
    } catch (error) {
      return `Could not read display sidecar logs: ${this.engine.errorMessage(error)}`;
    }
  }

  private async findSidecar() {
    if (this.displaySidecarContainerId) {
      try {
        const container = this.docker.getContainer(
          this.displaySidecarContainerId,
        );
        await this.engine.read(
          () => container.inspect(),
          'Inspect configured display sidecar',
        );
        return container;
      } catch (error) {
        if (!this.engine.isDockerNotFound(error)) {
          throw error;
        }
      }
    }

    const existing = await this.lifecycle.findContainerByName(
      this.displaySidecarContainerName,
    );
    return existing ? this.docker.getContainer(existing.Id) : null;
  }

  /**
   * Returns a consistent viewer error payload when the sidecar is unavailable.
   */
  private sidecarUnavailableStatus(): ViewerTargetStatus {
    const message =
      'Display sidecar is not available. Build the sidecar image or disable DISPLAY_SIDECAR_AUTO_START.';

    return {
      configured: false,
      connected: false,
      message,
      error: {
        code: 'sidecar_unavailable',
        message,
        retryable: false,
        exitCode: null,
        command: null,
        stdout: null,
        stderr: null,
      },
    };
  }
}
