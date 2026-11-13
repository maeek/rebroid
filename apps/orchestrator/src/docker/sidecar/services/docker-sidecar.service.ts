import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Dockerode from 'dockerode';
import type { OperationDeadline } from '../../../common/operation-deadline';
import type { DockerOperationOptions } from '../../contracts/docker-operation-options';
import { DockerOperationQueue } from '../../engine/utils/docker-operation-queue';
import { DockerContainerLifecycleService } from '../../containers/services/docker-container-lifecycle.service';
import { DockerEngineService } from '../../docker-engine.service';
import { ServiceHealth, ViewerTargetStatus } from '../../docker.types';
import {
  displaySidecarLogLimits,
  displaySidecarLogTail,
} from '../utils/display-sidecar-log-tail';
import { DockerSidecarAdbService } from './docker-sidecar-adb.service';
import { DockerSidecarApiService } from './docker-sidecar-api.service';
import { DockerSidecarImageService } from './docker-sidecar-image.service';
import { DockerSidecarNetworkService } from './docker-sidecar-network.service';
import { withHostTimezoneEnv } from '../../utils/docker-container-env.utils';
import type {
  AdbTargetPreparation,
  DockerSidecarAttachmentTimings,
  DockerSidecarPort,
} from '../../contracts/docker-sidecar.port';

interface DiscoveredSidecar {
  container: Dockerode.Container;
  inspect?: Dockerode.ContainerInspectInfo;
}

@Injectable()
export class DockerSidecarService implements OnModuleInit, DockerSidecarPort {
  private readonly logger = new Logger(DockerSidecarService.name);
  private readonly displaySidecarContainerId?: string;
  private readonly displaySidecarContainerName: string;
  private readonly displaySidecarImage: string;
  private readonly displaySidecarBuildContext: string;
  private readonly displaySidecarAutoStart: boolean;
  private readonly displaySidecarPlatformNetwork?: string;
  private readonly displaySidecarPort: number;
  private readonly displaySidecarPublishedHostPort: number;
  private readonly displaySidecarWebrtcUdpPort: number;
  private readonly displaySidecarWebrtcIceHost: string;
  private displaySidecarLastError: string | null = null;
  private readonly sidecarMutation = new DockerOperationQueue();
  private discoveredSidecarId?: string;
  private observedAdbTargetGeneration = 0;
  private observedSidecar?: { id: string; startedAt?: string };

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
    this.displaySidecarWebrtcUdpPort = this.config.getOrThrow<number>(
      'app.displaySidecar.webrtcUdpPort',
    );
    this.displaySidecarWebrtcIceHost = this.config.getOrThrow<string>(
      'app.displaySidecar.webrtcIceHost',
    );
  }

  private get docker() {
    return this.engine.docker;
  }

  get adbTargetGeneration() {
    return this.observedAdbTargetGeneration;
  }

  private invalidateAdbTargets() {
    this.observedAdbTargetGeneration += 1;
    this.observedSidecar = undefined;
  }

  private observeAdbTarget(id: string, startedAt?: string) {
    const previous = this.observedSidecar;
    if (
      previous &&
      (previous.id !== id ||
        (startedAt && previous.startedAt && startedAt !== previous.startedAt))
    ) {
      this.invalidateAdbTargets();
    }
    this.observedSidecar = {
      id,
      startedAt: startedAt ?? this.observedSidecar?.startedAt,
    };
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
    deadline?: OperationDeadline,
    timings?: DockerSidecarAttachmentTimings,
    signal?: AbortSignal,
  ): ReturnType<DockerSidecarPort['ensureSidecarOnNetwork']> {
    const options = { deadline, signal };
    const queuedAt = performance.now();
    let admitted = false;
    return this.queueSidecarMutation(async () => {
      admitted = true;
      if (timings)
        timings.sidecarQueueMs += Math.round(performance.now() - queuedAt);
      const preparationStartedAt = performance.now();
      const sidecar = await this.ensureSidecarUnlocked(options).finally(() => {
        if (timings)
          timings.sidecarPreparationMs += Math.round(
            performance.now() - preparationStartedAt,
          );
      });
      signal?.throwIfAborted();
      deadline?.throwIfExpired();
      const target = sidecar
        ? await this.sidecarNetwork.ensureOnNetwork(
            sidecar.container,
            networkName,
            sidecar.inspect,
            timings,
            options,
          )
        : this.sidecarUnavailableStatus();
      signal?.throwIfAborted();
      deadline?.throwIfExpired();
      return { ...target, sidecarGeneration: this.adbTargetGeneration };
    }, options).finally(() => {
      if (!admitted && timings)
        timings.sidecarQueueMs += Math.round(performance.now() - queuedAt);
    });
  }

  async detachSidecarFromNetwork(networkName: string) {
    await this.queueSidecarMutation(async () => {
      const sidecar = await this.findSidecar();
      if (!sidecar) {
        return;
      }

      await this.sidecarNetwork.detachFromNetwork(
        sidecar.container,
        networkName,
      );
    });
  }

  /**
   * Runs adb connect inside the sidecar and classifies common connection failures.
   */
  async connectAdb(
    adbHost: string,
    adbPort: number,
    deadline?: OperationDeadline,
    signal?: AbortSignal,
    purpose?: AdbTargetPreparation,
  ): Promise<ViewerTargetStatus> {
    const sidecar = await this.ensureSidecar({ deadline, signal });
    signal?.throwIfAborted();
    deadline?.throwIfExpired();
    if (!sidecar) {
      return this.sidecarUnavailableStatus();
    }

    return this.sidecarAdb.prepareTarget(
      sidecar.container.id,
      adbHost,
      adbPort,
      deadline,
      signal,
      purpose,
    );
  }

  /**
   * Returns the sidecar IP on a specific app network when it is attached.
   */
  async getSidecarIp(networkName: string) {
    const sidecar = await this.findSidecar();
    if (!sidecar) {
      return null;
    }

    return this.sidecarNetwork.getSidecarIp(
      sidecar.container,
      networkName,
      sidecar.inspect,
    );
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

      const inspect =
        sidecar.inspect ??
        (await this.lifecycle.inspectContainer(sidecar.container.id));
      const state = inspect.State;

      return {
        ok: false,
        status: 'unhealthy',
        message: state?.Running
          ? `Display sidecar is running, but its API is unreachable. ${apiError}`
          : `Display sidecar is ${state?.Status ?? 'not running'}. Exit code ${state?.ExitCode ?? 'unknown'}.${state?.Error ? ` Docker reported ${state.Error}` : ''}`,
        details: {
          containerId: inspect.Id.slice(0, 12),
          containerName: this.displaySidecarContainerName,
          image: this.displaySidecarImage,
          port: this.displaySidecarPort,
          publishedHostPort: this.displaySidecarPublishedHostPort || null,
          containerStatus: state?.Status ?? null,
          exitCode: state?.ExitCode ?? null,
          oomKilled: state?.OOMKilled ?? null,
          error: state?.Error || null,
          startedAt: state?.StartedAt || null,
          finishedAt: state?.FinishedAt?.startsWith('0001-01-01')
            ? null
            : state?.FinishedAt || null,
          restartCount: inspect.RestartCount ?? null,
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
      message: `Display sidecar API is unreachable. ${apiError}`,
    };
  }

  async getLogs(expanded: boolean) {
    const sidecar = await this.findSidecar();
    if (!sidecar) {
      throw new NotFoundException(
        'Display sidecar container is not available.',
      );
    }

    const limits = expanded
      ? displaySidecarLogLimits.expanded
      : displaySidecarLogLimits.preview;
    const output = await this.lifecycle.getBoundedContainerLogs(
      sidecar.container.id,
      limits.lines + 1,
      limits.readBytes,
    );
    return displaySidecarLogTail(output, limits);
  }

  async listDisplaySessions() {
    return this.sidecarApi.listDisplaySessions();
  }

  revokeDisplaySessions(ownerUserIds: readonly string[]) {
    return this.sidecarApi.revokeDisplaySessions(ownerUserIds);
  }

  async releaseDisplaySession(id: string) {
    return this.sidecarApi.releaseDisplaySession(id);
  }

  /**
   * Restarts an existing sidecar or creates it if autostart is enabled.
   */
  async repair() {
    return this.queueSidecarMutation(async () => {
      this.invalidateAdbTargets();
      try {
        const existing = await this.findSidecar();
        if (existing) {
          await this.lifecycle.stopContainer(existing.container.id, 3);
          await this.lifecycle.startContainer(existing.container.id);
          await this.sidecarApi.waitForReady();
          await this.sidecarNetwork.cleanupStaleNetworks(existing.container);
          this.displaySidecarLastError = null;
          return existing.container.id;
        }

        const created = await this.ensureSidecarUnlocked();
        if (!created) {
          throw new ConflictException('Display sidecar autostart is disabled.');
        }

        this.displaySidecarLastError = null;
        return created.container.id;
      } catch (error) {
        this.displaySidecarLastError = this.engine.errorMessage(error);
        throw error;
      }
    });
  }

  /**
   * Returns a started sidecar container, creating one only when autostart is enabled.
   */
  private async ensureSidecar(options?: DockerOperationOptions) {
    return this.queueSidecarMutation(
      () => this.ensureSidecarUnlocked(options),
      options,
    );
  }

  private async ensureSidecarUnlocked(
    options?: DockerOperationOptions,
  ): Promise<DiscoveredSidecar | null> {
    const { deadline, signal } = options ?? {};
    signal?.throwIfAborted();
    deadline?.throwIfExpired();
    const existing = await this.findSidecar(options);
    if (existing) {
      const { container } = existing;
      const inspect =
        existing.inspect ??
        (await this.lifecycle.inspectContainer(container.id, options));
      signal?.throwIfAborted();
      deadline?.throwIfExpired();
      if (!inspect.State?.Running) {
        this.invalidateAdbTargets();
        await this.lifecycle.startContainer(container.id, options);
        signal?.throwIfAborted();
        deadline?.throwIfExpired();
        await this.sidecarApi.waitForReady(10_000, options);
        this.observeAdbTarget(container.id);
        return { container };
      }
      this.observeAdbTarget(container.id, inspect.State.StartedAt);
      return { container, inspect };
    }

    if (this.observedSidecar) this.invalidateAdbTargets();

    if (!this.displaySidecarAutoStart) {
      return null;
    }

    signal?.throwIfAborted();
    deadline?.throwIfExpired();
    await this.sidecarImages.ensureImage(
      this.displaySidecarImage,
      this.displaySidecarBuildContext,
    );
    signal?.throwIfAborted();
    deadline?.throwIfExpired();
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
    const mediaPort = `${this.displaySidecarWebrtcUdpPort}/udp`;
    hostConfig.PortBindings = {
      ...(hostConfig.PortBindings ?? {}),
      [mediaPort]: [
        {
          HostIp: '0.0.0.0',
          HostPort: String(this.displaySidecarWebrtcUdpPort),
        },
      ],
    };

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
            `WEB_INTERNAL_URL=${this.config.getOrThrow<string>('app.webInternalUrl')}`,
            ...(this.config.get<string>('app.sharedSecret')
              ? [
                  `DISPLAY_SIDECAR_SHARED_SECRET=${this.config.get<string>('app.sharedSecret')}`,
                ]
              : []),
            `DISPLAY_WEBRTC_UDP_PORT=${this.displaySidecarWebrtcUdpPort}`,
            ...(this.displaySidecarWebrtcIceHost
              ? [`DISPLAY_WEBRTC_ICE_HOST=${this.displaySidecarWebrtcIceHost}`]
              : []),
          ]),
          ExposedPorts: {
            [`${this.displaySidecarPort}/tcp`]: {},
            [mediaPort]: {},
          },
          Labels: this.engine.labels('platform', 'display-sidecar'),
          HostConfig: hostConfig,
          NetworkingConfig: networkingConfig,
        }),
      `Create display sidecar ${this.displaySidecarContainerName}`,
      options,
    );
    await this.engine.mutate(
      () => container.start(),
      `Start display sidecar ${container.id}`,
      options,
    );
    signal?.throwIfAborted();
    deadline?.throwIfExpired();
    await this.sidecarApi.waitForReady(10_000, options);
    this.observeAdbTarget(container.id);
    return { container };
  }

  private async initializeSidecarOnStartup() {
    return this.queueSidecarMutation(async () => {
      const sidecar = await this.ensureSidecarUnlocked();
      if (!sidecar) {
        return null;
      }

      await this.sidecarNetwork.cleanupStaleNetworks(sidecar.container);
      this.displaySidecarLastError = null;
      return sidecar;
    });
  }

  private queueSidecarMutation<T>(
    operation: () => Promise<T>,
    options?: DockerOperationOptions,
  ) {
    return this.sidecarMutation.run(operation, options);
  }

  private async findSidecar(
    options?: DockerOperationOptions,
  ): Promise<DiscoveredSidecar | null> {
    const candidateId =
      this.displaySidecarContainerId ?? this.discoveredSidecarId;
    if (candidateId) {
      try {
        const inspect = await this.lifecycle.inspectContainer(
          candidateId,
          options,
        );
        if (
          this.displaySidecarContainerId ||
          inspect.Name === `/${this.displaySidecarContainerName}`
        ) {
          this.discoveredSidecarId = inspect.Id;
          return { container: this.docker.getContainer(inspect.Id), inspect };
        }
        this.discoveredSidecarId = undefined;
        if (this.observedSidecar?.id === candidateId)
          this.invalidateAdbTargets();
      } catch (error) {
        if (!this.engine.isDockerNotFound(error)) throw error;
        if (this.discoveredSidecarId === candidateId)
          this.discoveredSidecarId = undefined;
        if (this.observedSidecar?.id === candidateId)
          this.invalidateAdbTargets();
      }
    }

    const existing = await this.lifecycle.findContainerByName(
      this.displaySidecarContainerName,
      undefined,
      options,
    );
    if (!existing) return null;
    this.discoveredSidecarId = existing.Id;
    return { container: this.docker.getContainer(existing.Id) };
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
