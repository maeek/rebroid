import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Dockerode from 'dockerode';
import { join, relative, sep } from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';
import tar from 'tar-stream';
import { DockerContainerExecService } from '../../containers/services/docker-container-exec.service';
import { DockerContainerLifecycleService } from '../../containers/services/docker-container-lifecycle.service';
import { DockerEngineService } from '../../docker-engine.service';
import { DockerImageRuntimeService } from '../../images/services/docker-image-runtime.service';
import { DockerNetworkRuntimeService } from '../../networks/services/docker-network-runtime.service';
import {
  ContainerCommandFailure,
  ContainerCommandFailedException,
  ServiceHealth,
  ViewerTargetError,
  ViewerTargetStatus,
} from '../../docker.types';
import {
  isTransientAdbConnectionError,
  shouldIgnoreBuildContextEntry,
} from '../utils/docker-sidecar.utils';

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

  constructor(
    private readonly config: ConfigService,
    private readonly engine: DockerEngineService,
    private readonly exec: DockerContainerExecService,
    private readonly lifecycle: DockerContainerLifecycleService,
    private readonly images: DockerImageRuntimeService,
    private readonly networks: DockerNetworkRuntimeService,
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
    const sidecar = await this.ensureSidecar();
    if (!sidecar) {
      return this.sidecarUnavailableStatus();
    }

    await this.networks.connectContainerToNetwork(sidecar.id, networkName);
    const sidecarIp = await this.getSidecarIp(networkName);
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

    return {
      configured: true,
      connected: true,
      message: `Display sidecar is attached to ${networkName} as ${sidecarIp}.`,
      error: null,
    };
  }

  async detachSidecarFromNetwork(networkName: string) {
    const sidecar = await this.findSidecar();
    if (!sidecar) {
      return;
    }

    await this.networks.disconnectContainerFromNetwork(sidecar.id, networkName);
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

    try {
      const target = `${adbHost}:${adbPort}`;
      const tcpProbe = await this.probeTcpTarget(sidecar.id, adbHost, adbPort);
      if (tcpProbe) {
        return {
          configured: true,
          connected: false,
          message: tcpProbe.message,
          error: tcpProbe,
        };
      }

      const connectCommand = [
        'sh',
        '-lc',
        [
          `timeout 5s adb disconnect ${this.shellQuote(target)} >/dev/null 2>&1 || true`,
          `timeout 10s adb connect ${this.shellQuote(target)}`,
        ].join('; '),
      ];
      const output = await this.exec.execInContainerWithOutput(sidecar.id, [
        ...connectCommand,
      ], { timeoutMs: 20_000 });
      const connectFailure = this.viewerTargetErrorFromOutput({
        command: connectCommand,
        stdout: output.stdout,
        stderr: output.stderr,
      });
      if (connectFailure) {
        return {
          configured: true,
          connected: false,
          message: connectFailure.message,
          error: connectFailure,
        };
      }

      const stateCommand = [
        'sh',
        '-lc',
        `timeout 10s adb -s ${this.shellQuote(target)} get-state 2>&1 || true`,
      ];
      const state = await this.exec.execInContainerWithOutput(sidecar.id, [
        ...stateCommand,
      ], { timeoutMs: 15_000 });
      let currentState = state.stdout.trim().toLowerCase();
      let lastStateCommand = stateCommand;
      let lastState = state;

      if (currentState.includes('offline')) {
        const recoveryCommand = [
          'sh',
          '-lc',
          [
            `timeout 5s adb disconnect ${this.shellQuote(target)} >/dev/null 2>&1 || true`,
            'timeout 5s adb reconnect offline >/dev/null 2>&1 || true',
            'timeout 5s adb kill-server >/dev/null 2>&1 || true',
            'timeout 5s adb start-server >/dev/null 2>&1 || true',
            `timeout 10s adb connect ${this.shellQuote(target)}`,
            `timeout 30s adb -s ${this.shellQuote(target)} wait-for-device`,
            `timeout 10s adb -s ${this.shellQuote(target)} get-state 2>&1 || true`,
          ].join('; '),
        ];
        lastStateCommand = recoveryCommand;
        lastState = await this.exec.execInContainerWithOutput(
          sidecar.id,
          recoveryCommand,
          { timeoutMs: 45_000 },
        );
        const stateTokens = lastState.stdout.trim().toLowerCase().split(/\s+/);
        currentState = stateTokens[stateTokens.length - 1] ?? '';
      }

      if (currentState !== 'device') {
        const viewerError = this.viewerTargetErrorFromOutput({
          command: lastStateCommand,
          stdout: lastState.stdout,
          stderr: lastState.stderr,
          fallbackMessage: `ADB target ${target} is not ready: ${lastState.stdout.trim() || 'unknown state'}.`,
        }) ?? {
          code: 'adb_unreachable',
          message: `ADB target ${target} is not ready.`,
          retryable: true,
          exitCode: 0,
          command: lastStateCommand,
          stdout: lastState.stdout,
          stderr: lastState.stderr,
        };
        return {
          configured: true,
          connected: false,
          message: viewerError.message,
          error: viewerError,
        };
      }

      await this.prepareAndroidDisplay(sidecar.id, target);

      return {
        configured: true,
        connected: true,
        message: [output.stdout, output.stderr, state.stdout]
          .filter(Boolean)
          .join('\n'),
        error: null,
      };
    } catch (error) {
      const viewerError = this.viewerTargetError(error);
      this.logger.warn(
        `Unable to prepare display sidecar ADB target ${adbHost}:${adbPort}: ${viewerError.message}`,
      );
      return {
        configured: true,
        connected: false,
        message: viewerError.message,
        error: viewerError,
      };
    }
  }

  private async prepareAndroidDisplay(
    sidecarId: string,
    target: string,
  ): Promise<void> {
    const command = [
      'sh',
      '-lc',
      [
        `timeout 10s adb -s ${this.shellQuote(target)} shell ${this.shellQuote(
          [
            'settings put system screen_off_timeout 2147483647 >/dev/null 2>&1 || true',
            'svc power stayon true >/dev/null 2>&1 || true',
            'input keyevent WAKEUP >/dev/null 2>&1 || input keyevent 224 >/dev/null 2>&1 || true',
            'wm dismiss-keyguard >/dev/null 2>&1 || input keyevent MENU >/dev/null 2>&1 || true',
          ].join('; '),
        )}`,
      ].join(' && '),
    ];

    try {
      await this.exec.execInContainerWithOutput(sidecarId, command, {
        timeoutMs: 15_000,
      });
    } catch (error) {
      const viewerError = this.viewerTargetError(error);
      this.logger.warn(
        `Unable to prepare Android display for ${target}: ${viewerError.message}`,
      );
    }
  }

  /**
   * Returns the sidecar IP on a specific app network when it is attached.
   */
  async getSidecarIp(networkName: string) {
    const sidecar = await this.findSidecar();
    if (!sidecar) {
      return null;
    }

    try {
      const inspect = await sidecar.inspect();
      return inspect.NetworkSettings.Networks?.[networkName]?.IPAddress || null;
    } catch {
      return null;
    }
  }

  /**
   * Reports whether the sidecar exists and is currently running.
   * Cached startup errors are surfaced when autostart failed earlier.
   */
  async health(): Promise<ServiceHealth> {
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

      const inspect = await sidecar.inspect();
      const running = Boolean(inspect.State?.Running);
      if (running) {
        this.displaySidecarLastError = null;
      }

      return {
        ok: running,
        status: running ? 'healthy' : 'unhealthy',
        message: running
          ? 'Display sidecar is running.'
          : `Display sidecar is ${inspect.State?.Status ?? 'not running'}.`,
        details: {
          containerId: inspect.Id.slice(0, 12),
          containerName: this.displaySidecarContainerName,
          image: this.displaySidecarImage,
          port: this.displaySidecarPort,
          publishedHostPort: this.displaySidecarPublishedHostPort || null,
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

  /**
   * Restarts an existing sidecar or creates it if autostart is enabled.
   */
  async repair() {
    try {
      const existing = await this.findSidecar();
      if (existing) {
        await this.lifecycle.stopContainer(existing.id, 3);
        await this.lifecycle.startContainer(existing.id);
        await this.cleanupStaleSidecarNetworks(existing);
        this.displaySidecarLastError = null;
        return existing.id;
      }

      const created = await this.ensureSidecar();
      if (!created) {
        throw new ConflictException('Display sidecar autostart is disabled.');
      }

      this.displaySidecarLastError = null;
      return created.id;
    } catch (error) {
      this.displaySidecarLastError = this.engine.errorMessage(error);
      throw error;
    }
  }

  /**
   * Returns a started sidecar container, creating one only when autostart is enabled.
   */
  private async ensureSidecar() {
    const existing = await this.findSidecar();
    if (existing) {
      await this.lifecycle.startContainer(existing.id);
      return existing;
    }

    if (!this.displaySidecarAutoStart) {
      return null;
    }

    await this.ensureSidecarImage();
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
    const webrtcPortBinding = this.webrtcUdpPortBinding();
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

    const container = await this.docker.createContainer({
      Image: this.displaySidecarImage,
      name: this.displaySidecarContainerName,
      Env: [
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
      ],
      ExposedPorts: {
        [`${this.displaySidecarPort}/tcp`]: {},
        ...(webrtcPortBinding?.exposedPorts ?? {}),
      },
      Labels: this.engine.labels('platform', 'display-sidecar'),
      HostConfig: hostConfig,
      NetworkingConfig: networkingConfig,
    });
    await container.start();
    return container;
  }

  private webrtcUdpPortBinding() {
    const [start, end] = this.displaySidecarWebrtcUdpPortRange
      .split('-')
      .map((value) => Number(value));
    if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start) {
      return null;
    }

    const portBindings: NonNullable<Dockerode.HostConfig['PortBindings']> = {};
    const exposedPorts: Record<string, Record<string, never>> = {};
    for (let port = start; port <= end; port += 1) {
      const key = `${port}/udp`;
      portBindings[key] = [{ HostIp: '0.0.0.0', HostPort: String(port) }];
      exposedPorts[key] = {};
    }
    return { portBindings, exposedPorts };
  }

  private async initializeSidecarOnStartup() {
    const sidecar = await this.ensureSidecar();
    if (!sidecar) {
      return null;
    }

    await this.cleanupStaleSidecarNetworks(sidecar);
    this.displaySidecarLastError = null;
    return sidecar;
  }

  private async cleanupStaleSidecarNetworks(sidecar: Dockerode.Container) {
    const inspect = await sidecar.inspect();
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

  private isStaleSidecarNetwork(networkName: string) {
    if (networkName === this.displaySidecarPlatformNetwork) {
      return false;
    }

    return networkName.startsWith(`${this.engine.resourcePrefix}-net-`);
  }

  private async findSidecar() {
    if (this.displaySidecarContainerId) {
      try {
        const container = this.docker.getContainer(this.displaySidecarContainerId);
        await container.inspect();
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
   * Builds the sidecar image from the local build context when it is missing.
   */
  private async ensureSidecarImage() {
    if (await this.images.imageExists(this.displaySidecarImage)) {
      return;
    }

    this.logger.log(
      `Building missing display sidecar image ${this.displaySidecarImage} from ${this.displaySidecarBuildContext}.`,
    );
    const context = await this.createBuildContextTar(this.displaySidecarBuildContext);
    const stream = await this.docker.buildImage(context, {
      t: this.displaySidecarImage,
    });
    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(
        stream,
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        },
        (event) => {
          const message = event.stream?.trim() || event.errorDetail?.message;
          if (message) {
            this.logger.debug(`[display-sidecar build] ${message}`);
          }
        },
      );
    });
  }

  /**
   * Packs the configured build context into a tar stream for Docker image builds.
   */
  private async createBuildContextTar(directory: string) {
    const directoryStat = await stat(directory);
    if (!directoryStat.isDirectory()) {
      throw new ConflictException(
        `Display sidecar build context is not a directory: ${directory}`,
      );
    }

    const pack = tar.pack();
    await this.addDirectoryToTar(pack, directory, directory);
    pack.finalize();
    return pack;
  }

  private async addDirectoryToTar(
    pack: tar.Pack,
    rootDirectory: string,
    currentDirectory: string,
  ) {
    const entries = await readdir(currentDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (shouldIgnoreBuildContextEntry(entry.name)) {
        continue;
      }

      const absolutePath = join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await this.addDirectoryToTar(pack, rootDirectory, absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const content = await readFile(absolutePath);
      const entryStat = await stat(absolutePath);
      const tarPath = relative(rootDirectory, absolutePath)
        .split(sep)
        .join('/');
      await new Promise<void>((resolve, reject) => {
        pack.entry(
          {
            name: tarPath,
            mode: entryStat.mode,
            size: content.length,
          },
          content,
          (error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          },
        );
      });
    }
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

  private viewerTargetError(error: unknown): ViewerTargetError {
    if (error instanceof ContainerCommandFailedException) {
      return this.classifyViewerTargetError(error.details);
    }

    const message = this.engine.errorMessage(error);
    return {
      code: 'unknown',
      message,
      retryable: false,
      exitCode: null,
      command: null,
      stdout: null,
      stderr: null,
    };
  }

  private shellQuote(value: string) {
    return `'${value.replaceAll("'", "'\\''")}'`;
  }

  private async probeTcpTarget(
    sidecarId: string,
    adbHost: string,
    adbPort: number,
  ): Promise<ViewerTargetError | null> {
    const hostLiteral = JSON.stringify(adbHost);
    const portLiteral = JSON.stringify(adbPort);
    const probeCommand = [
      'sh',
      '-lc',
      [
        'node -e',
        this.shellQuote(
          [
            'const net = require("node:net");',
            `const host = ${hostLiteral};`,
            `const port = ${portLiteral};`,
            'const socket = net.createConnection({ host, port });',
            'socket.setTimeout(3000);',
            'socket.on("connect", () => {',
            '  process.stdout.write(`tcp:${host}:${port} reachable`);',
            '  socket.end();',
            '});',
            'socket.on("timeout", () => {',
            '  process.stderr.write(`tcp probe timed out for ${host}:${port}`);',
            '  socket.destroy();',
            '  process.exit(124);',
            '});',
            'socket.on("error", (error) => {',
            '  process.stderr.write(`tcp probe failed for ${host}:${port}: ${error.message}`);',
            '  process.exit(1);',
            '});',
          ].join(' '),
        ),
      ].join(' '),
    ];

    try {
      await this.exec.execInContainerWithOutput(sidecarId, probeCommand, {
        timeoutMs: 5_000,
      });
      return null;
    } catch (error) {
      const viewerError = this.viewerTargetError(error);
      return {
        code: 'adb_unreachable',
        message:
          viewerError.stderr?.trim() ||
          viewerError.stdout?.trim() ||
          `TCP probe to ${adbHost}:${adbPort} failed before adb connect.`,
        retryable: true,
        exitCode: viewerError.exitCode,
        command: probeCommand,
        stdout: viewerError.stdout,
        stderr: viewerError.stderr,
      };
    }
  }

  private viewerTargetErrorFromOutput({
    command,
    stdout,
    stderr,
    fallbackMessage,
  }: {
    command: string[];
    stdout: string;
    stderr: string;
    fallbackMessage?: string;
  }): ViewerTargetError | null {
    const combinedOutput = [stderr, stdout].filter(Boolean).join('\n');

    if (!isTransientAdbConnectionError(combinedOutput)) {
      if (!fallbackMessage) {
        return null;
      }

      return {
        code: 'adb_unreachable',
        message: fallbackMessage,
        retryable: true,
        exitCode: 0,
        command,
        stdout,
        stderr,
      };
    }

    return {
      code: 'adb_unreachable',
      message:
        combinedOutput.trim() ||
        fallbackMessage ||
        'ADB target is not reachable.',
      retryable: true,
      exitCode: 0,
      command,
      stdout,
      stderr,
    };
  }

  /**
   * Maps adb command failures into retryable and non-retryable viewer errors.
   */
  private classifyViewerTargetError(
    details: ContainerCommandFailure,
  ): ViewerTargetError {
    const combinedOutput = [details.stderr, details.stdout]
      .filter(Boolean)
      .join('\n')
      .toLowerCase();

    if (
      details.exitCode === 127 &&
      combinedOutput.includes('adb') &&
      combinedOutput.includes('not found')
    ) {
      return {
        code: 'adb_missing',
        message: details.message,
        retryable: false,
        exitCode: details.exitCode,
        command: details.command,
        stdout: details.stdout,
        stderr: details.stderr,
      };
    }

    if (isTransientAdbConnectionError(combinedOutput)) {
      return {
        code: 'adb_unreachable',
        message: details.message,
        retryable: true,
        exitCode: details.exitCode,
        command: details.command,
        stdout: details.stdout,
        stderr: details.stderr,
      };
    }

    return {
      code: 'unknown',
      message: details.message,
      retryable: false,
      exitCode: details.exitCode,
      command: details.command,
      stdout: details.stdout,
      stderr: details.stderr,
    };
  }
}
