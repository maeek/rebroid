import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setTimeout as delay } from 'node:timers/promises';
import { getErrorMessage } from '../../../common/error-message';
import { ViewerTargetStatus } from '../../../docker/docker.types';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { AndroidApplicationStatus } from '../../android-application-status';
import type { ApplicationViewerControlCommand } from '../dto/application-viewer-control.dto';
import { ScrcpySessionDto } from '../dto/scrcpy-session.dto';
import { AndroidAppsDisplaySidecarService } from './android-apps-display-sidecar.service';
import { AndroidAppsSidecarAdbService } from './android-apps-sidecar-adb.service';
import { AndroidAppsViewerNetworkService } from './android-apps-viewer-network.service';

@Injectable()
export class AndroidAppsViewerService {
  private readonly logger = new Logger(AndroidAppsViewerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly displaySidecar: AndroidAppsDisplaySidecarService,
    private readonly sidecarAdb: AndroidAppsSidecarAdbService,
    private readonly state: AndroidAppsStateService,
    private readonly viewerNetwork: AndroidAppsViewerNetworkService,
  ) {}

  /** Builds the viewer session data for scrcpy. */
  async scrcpySession(
    id: string,
    access: { control?: boolean; clipboard?: boolean } = {},
  ): Promise<ScrcpySessionDto> {
    const app = await this.getRunningRuntimeApp(id);
    const proxyRemote =
      this.config.get<string>('app.displaySidecar.proxyRemote') ?? 'tcp:8886';
    const { adbHost, viewerTarget } = await this.prepareViewerTarget(app);
    const udid = `${adbHost}:${app.adbPort}`;
    const displaySession =
      viewerTarget.configured && viewerTarget.connected
        ? await this.displaySidecar.tryCreateSessionForPreparedTarget(
            app,
            udid,
            [
              'video',
              'audio',
              ...(access.control ? ['control'] : []),
              ...(access.clipboard ? ['clipboard'] : []),
            ],
          )
        : null;
    app.lastScrcpyActivityAt = new Date();
    await this.state.save(app);

    return {
      applicationId: app.id,
      transport: app.scrcpyTransport,
      udid,
      proxyRemote,
      player: this.config.getOrThrow<string>('app.displaySidecar.player'),
      viewerServiceConfigured: viewerTarget.configured,
      viewerTargetConnected: viewerTarget.connected,
      viewerMessage: viewerTarget.message,
      viewerError: viewerTarget.error,
      adbHost,
      adbPort: app.adbPort,
      displaySession,
    };
  }

  /** Retries the lazy sidecar attachment while a freshly started runtime settles. */
  private async prepareViewerTarget(app: Awaited<ReturnType<AndroidAppsViewerService['getRunningRuntimeApp']>>) {
    const maxAttempts = 3;
    let adbHost = app.containerName;
    let viewerTarget: ViewerTargetStatus | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const sidecarTarget =
          await this.viewerNetwork.ensureNetworkPrepared(app);
        adbHost = await this.viewerNetwork.resolveScrcpyAdbHost(app);
        viewerTarget =
          sidecarTarget.configured && sidecarTarget.connected
            ? await this.viewerNetwork.prepareScrcpyAdbTarget(app, adbHost)
            : sidecarTarget;
      } catch (error) {
        const message = getErrorMessage(error);
        viewerTarget = {
          configured: true,
          connected: false,
          message,
          error: {
            code: 'unknown',
            message,
            retryable: true,
            exitCode: null,
            command: null,
            stdout: null,
            stderr: null,
          },
        };
      }

      if (viewerTarget.connected || !viewerTarget.error?.retryable) {
        return { adbHost, viewerTarget };
      }

      if (attempt < maxAttempts) {
        this.logger.warn(
          `Viewer bootstrap for ${app.id} is not ready. Retrying ${attempt}/${maxAttempts - 1}: ${viewerTarget.message}`,
        );
        await delay(1_000);
      }
    }

    return { adbHost, viewerTarget: viewerTarget! };
  }

  /** Saves the latest viewer activity time. */
  async recordViewerActivity(id: string) {
    const app = await this.getRunningRuntimeApp(id);
    app.lastScrcpyActivityAt = new Date();
    await this.state.save(app);

    return {
      id: app.id,
      lastScrcpyActivityAt: app.lastScrcpyActivityAt.toISOString(),
    };
  }

  /** Sends one control action to the viewer runtime. */
  async viewerControl(id: string, command: ApplicationViewerControlCommand) {
    const app = await this.getRunningRuntimeApp(id);
    const sidecarPath = await this.tryDisplaySidecarControl(app, command);
    await this.recordViewerActivity(id);

    return {
      command,
      executed: true,
      message:
        sidecarPath === 'display'
          ? 'Viewer control command executed through display sidecar.'
          : 'Viewer control command executed through display sidecar ADB endpoint.',
    };
  }

  /** Loads one running app for viewer actions. */
  private async getRunningRuntimeApp(id: string) {
    const app = await this.state.get(id);
    if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
      throw new ConflictException(
        'Application must be running before using viewer runtime tools.',
      );
    }

    return app;
  }

  private async tryDisplaySidecarControl(
    app: Awaited<ReturnType<AndroidAppsViewerService['getRunningRuntimeApp']>>,
    command: ApplicationViewerControlCommand,
  ) {
    try {
      await this.displaySidecar.viewerControl(app, command);
      return 'display' as const;
    } catch (error) {
      await this.sidecarAdb.viewerControl(app, command).catch((legacyError) => {
        throw new ConflictException(
          `Viewer control command failed. Display sidecar: ${getErrorMessage(
            error,
          )}. Display sidecar ADB endpoint: ${getErrorMessage(legacyError)}.`,
        );
      });
      return 'adb' as const;
    }
  }
}
