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
import { DockerEngineService } from './docker-engine.service';
import {
  ContainerCommandFailure,
  ContainerCommandFailedException,
  ServiceHealth,
  ViewerTargetError,
  ViewerTargetStatus,
} from './docker.types';
import {
  isTransientAdbConnectionError,
  shouldIgnoreBuildContextEntry,
} from './utils/docker-sidecar.utils';

@Injectable()
export class DockerSidecarService implements OnModuleInit {
  private readonly logger = new Logger(DockerSidecarService.name);
  private readonly wsScrcpyContainerId?: string;
  private readonly wsScrcpyContainerName: string;
  private readonly wsScrcpyImage: string;
  private readonly wsScrcpyBuildContext: string;
  private readonly wsScrcpyAutoStart: boolean;
  private readonly wsScrcpyPlatformNetwork?: string;
  private readonly wsScrcpyPort: number;
  private wsScrcpyLastError: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly engine: DockerEngineService,
  ) {
    this.wsScrcpyContainerId = this.config.get<string>(
      'app.scrcpy.wsScrcpyContainerId',
    );
    this.wsScrcpyContainerName = this.config.getOrThrow<string>(
      'app.scrcpy.wsScrcpyContainerName',
    );
    this.wsScrcpyImage = this.config.getOrThrow<string>(
      'app.scrcpy.wsScrcpyImage',
    );
    this.wsScrcpyBuildContext = this.config.getOrThrow<string>(
      'app.scrcpy.wsScrcpyBuildContext',
    );
    this.wsScrcpyAutoStart = this.config.getOrThrow<boolean>(
      'app.scrcpy.wsScrcpyAutoStart',
    );
    this.wsScrcpyPlatformNetwork = this.config.get<string>(
      'app.scrcpy.wsScrcpyPlatformNetwork',
    );
    this.wsScrcpyPort = this.config.getOrThrow<number>('app.scrcpy.wsScrcpyPort');
  }

  private get docker() {
    return this.engine.docker;
  }

  onModuleInit() {
    if (!this.wsScrcpyAutoStart) {
      return;
    }

    void this.ensureSidecar().catch((error) => {
      this.wsScrcpyLastError = this.engine.errorMessage(error);
      this.logger.warn(
        `ws-scrcpy sidecar was not started automatically: ${this.wsScrcpyLastError}`,
      );
    });
  }

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

  async ensureSidecarOnNetwork(
    networkName: string,
  ): Promise<ViewerTargetStatus> {
    const sidecar = await this.ensureSidecar();
    if (!sidecar) {
      return this.sidecarUnavailableStatus();
    }

    await this.engine.connectContainerToNetwork(sidecar.id, networkName);
    return {
      configured: true,
      connected: true,
      message: `ws-scrcpy sidecar is attached to ${networkName}.`,
      error: null,
    };
  }

  async connectAdb(
    adbHost: string,
    adbPort: number,
  ): Promise<ViewerTargetStatus> {
    const sidecar = await this.ensureSidecar();
    if (!sidecar) {
      return this.sidecarUnavailableStatus();
    }

    try {
      const output = await this.engine.execInContainerWithOutput(sidecar.id, [
        'adb',
        'connect',
        `${adbHost}:${adbPort}`,
      ]);
      return {
        configured: true,
        connected: true,
        message: [output.stdout, output.stderr].filter(Boolean).join('\n'),
        error: null,
      };
    } catch (error) {
      const viewerError = this.viewerTargetError(error);
      this.logger.warn(
        `Unable to prepare ws-scrcpy adb target ${adbHost}:${adbPort}: ${viewerError.message}`,
      );
      return {
        configured: true,
        connected: false,
        message: viewerError.message,
        error: viewerError,
      };
    }
  }

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

  async health(): Promise<ServiceHealth> {
    try {
      const sidecar = await this.findSidecar();
      if (!sidecar) {
        return {
          ok: false,
          status: 'offline',
          message: this.wsScrcpyAutoStart
            ? (this.wsScrcpyLastError ??
              `Sidecar container ${this.wsScrcpyContainerName} is not created yet.`)
            : 'Sidecar autostart is disabled.',
          details: {
            image: this.wsScrcpyImage,
            containerName: this.wsScrcpyContainerName,
            autoStart: this.wsScrcpyAutoStart,
          },
        };
      }

      const inspect = await sidecar.inspect();
      const running = Boolean(inspect.State?.Running);
      if (running) {
        this.wsScrcpyLastError = null;
      }

      return {
        ok: running,
        status: running ? 'healthy' : 'unhealthy',
        message: running
          ? 'ws-scrcpy sidecar is running.'
          : `ws-scrcpy sidecar is ${inspect.State?.Status ?? 'not running'}.`,
        details: {
          containerId: inspect.Id.slice(0, 12),
          containerName: this.wsScrcpyContainerName,
          image: this.wsScrcpyImage,
          port: this.wsScrcpyPort,
        },
      };
    } catch (error) {
      return {
        ok: false,
        status: 'offline',
        message: this.engine.errorMessage(error),
        details: {
          image: this.wsScrcpyImage,
          containerName: this.wsScrcpyContainerName,
        },
      };
    }
  }

  async repair() {
    try {
      const existing = await this.findSidecar();
      if (existing) {
        await this.engine.stopContainer(existing.id, 3);
        await this.engine.startContainer(existing.id);
        this.wsScrcpyLastError = null;
        return existing.id;
      }

      const created = await this.ensureSidecar();
      if (!created) {
        throw new ConflictException(
          'ws-scrcpy sidecar autostart is disabled.',
        );
      }

      this.wsScrcpyLastError = null;
      return created.id;
    } catch (error) {
      this.wsScrcpyLastError = this.engine.errorMessage(error);
      throw error;
    }
  }

  private async ensureSidecar() {
    const existing = await this.findSidecar();
    if (existing) {
      await this.engine.startContainer(existing.id);
      return existing;
    }

    if (!this.wsScrcpyAutoStart) {
      return null;
    }

    await this.ensureSidecarImage();
    const hostConfig: Dockerode.HostConfig = {
      AutoRemove: false,
      PublishAllPorts: false,
      RestartPolicy: { Name: 'unless-stopped' },
    };

    if (this.wsScrcpyPlatformNetwork) {
      hostConfig.NetworkMode = this.wsScrcpyPlatformNetwork;
    }

    const networkingConfig = this.wsScrcpyPlatformNetwork
      ? {
          EndpointsConfig: {
            [this.wsScrcpyPlatformNetwork]: {},
          },
        }
      : undefined;

    const container = await this.docker.createContainer({
      Image: this.wsScrcpyImage,
      name: this.wsScrcpyContainerName,
      Env: [
        'WS_SCRCPY_PATHNAME=/viewer/ws-scrcpy',
        'WS_SCRCPY_CONFIG=/etc/ws-scrcpy/config.yaml',
      ],
      ExposedPorts: {
        [`${this.wsScrcpyPort}/tcp`]: {},
      },
      Labels: this.engine.labels('platform', 'scrcpy-sidecar'),
      HostConfig: hostConfig,
      NetworkingConfig: networkingConfig,
    });
    await container.start();
    return container;
  }

  private async findSidecar() {
    if (this.wsScrcpyContainerId) {
      try {
        const container = this.docker.getContainer(this.wsScrcpyContainerId);
        await container.inspect();
        return container;
      } catch (error) {
        if (!this.engine.isDockerNotFound(error)) {
          throw error;
        }
      }
    }

    const existing = await this.engine.findContainerByName(
      this.wsScrcpyContainerName,
    );
    return existing ? this.docker.getContainer(existing.Id) : null;
  }

  private async ensureSidecarImage() {
    if (await this.engine.imageExists(this.wsScrcpyImage)) {
      return;
    }

    this.logger.log(
      `Building missing ws-scrcpy sidecar image ${this.wsScrcpyImage} from ${this.wsScrcpyBuildContext}.`,
    );
    const context = await this.createBuildContextTar(this.wsScrcpyBuildContext);
    const stream = await this.docker.buildImage(context, {
      t: this.wsScrcpyImage,
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
            this.logger.debug(`[ws-scrcpy build] ${message}`);
          }
        },
      );
    });
  }

  private async createBuildContextTar(directory: string) {
    const directoryStat = await stat(directory);
    if (!directoryStat.isDirectory()) {
      throw new ConflictException(
        `ws-scrcpy build context is not a directory: ${directory}`,
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
  private sidecarUnavailableStatus(): ViewerTargetStatus {
    const message =
      'ws-scrcpy sidecar is not available. Build the sidecar image or disable WS_SCRCPY_AUTO_START.';

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
