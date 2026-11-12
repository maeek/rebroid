import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setTimeout as delay } from 'node:timers/promises';
import { getErrorMessage } from '../../../common/error-message';
import { ViewerTargetStatus } from '../../../docker/docker.types';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import type { ApplicationViewerControlCommand } from '../../contracts/application-viewer-control';
import { ScrcpySessionDto } from '../dto/scrcpy-session.dto';
import { AndroidAppsDisplaySidecarService } from './android-apps-display-sidecar.service';
import {
  AndroidAppsViewerNetworkService,
  type PreparedViewerTarget,
  ViewerRuntimeChangedError,
} from './android-apps-viewer-network.service';

@Injectable()
export class AndroidAppsViewerService {
  private readonly logger = new Logger(AndroidAppsViewerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly displaySidecar: AndroidAppsDisplaySidecarService,
    private readonly queries: AndroidAppsQueryService,
    private readonly writer: AndroidAppsStateWriter,
    private readonly viewerNetwork: AndroidAppsViewerNetworkService,
  ) {}

  /** Builds the viewer session data for scrcpy. */
  async scrcpySession(
    id: string,
    access: {
      control?: boolean;
      clipboard?: boolean;
      screenshot?: boolean;
    } = {},
  ): Promise<ScrcpySessionDto> {
    const app = await this.getRunningRuntimeApp(id);
    const proxyRemote =
      this.config.get<string>('app.displaySidecar.proxyRemote') ?? 'tcp:8886';
    const { adbHost, viewerTarget, prepared } =
      await this.prepareViewerTarget(app);
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
              ...(access.screenshot ? ['screenshot'] : []),
            ],
          )
        : null;
    if (prepared && !displaySession) {
      this.viewerNetwork.invalidateViewerTarget(prepared);
    }
    await this.writer.recordViewerActivity(app);

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
  private async prepareViewerTarget(
    app: Awaited<ReturnType<AndroidAppsViewerService['getRunningRuntimeApp']>>,
  ) {
    const maxAttempts = 3;
    let adbHost = app.containerName;
    let viewerTarget: ViewerTargetStatus | null = null;
    let prepared: PreparedViewerTarget | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        prepared = await this.viewerNetwork.prepareViewerTarget(app);
        ({ adbHost, viewerTarget } = prepared);
      } catch (error) {
        prepared = undefined;
        const message = getErrorMessage(error);
        viewerTarget = {
          configured: true,
          connected: false,
          message,
          error: {
            code: 'unknown',
            message,
            retryable: !(error instanceof ViewerRuntimeChangedError),
            exitCode: null,
            command: null,
            stdout: null,
            stderr: null,
          },
        };
      }

      if (viewerTarget.connected || !viewerTarget.error?.retryable) {
        return { adbHost, viewerTarget, prepared };
      }

      if (attempt < maxAttempts) {
        this.logger.warn(
          `Viewer bootstrap for ${app.id} is not ready. Retrying ${attempt}/${maxAttempts - 1}: ${viewerTarget.message}`,
        );
        await delay(1_000);
      }
    }

    return { adbHost, viewerTarget: viewerTarget!, prepared };
  }

  /** Saves the latest viewer activity time. */
  async recordViewerActivity(id: string) {
    const app = await this.getRunningRuntimeApp(id);
    const observedAt = await this.writer.recordViewerActivity(app);

    return {
      id: app.id,
      lastScrcpyActivityAt: observedAt.toISOString(),
    };
  }

  /** Sends one control action to the viewer runtime. */
  async viewerControl(id: string, command: ApplicationViewerControlCommand) {
    const app = await this.getRunningRuntimeApp(id);
    await this.displaySidecar.viewerControl(app, command);
    await this.writer.recordViewerActivity(app);

    return {
      command,
      executed: true,
      message: 'Viewer control command executed through display sidecar.',
    };
  }

  /** Creates or reuses the app's single experimental virtual display surface. */
  async createVirtualDisplay(
    id: string,
    access: {
      control?: boolean;
      clipboard?: boolean;
      screenshot?: boolean;
    } = {},
  ) {
    const app = await this.getRunningRuntimeApp(id);
    const surface = await this.displaySidecar.createVirtualSurface(app, {
      name: 'Virtual display',
      width: 1280,
      height: 720,
      dpi: 160,
      capabilities: [
        'video',
        'audio',
        ...(access.control ? ['control'] : []),
        ...(access.clipboard ? ['clipboard'] : []),
        ...(access.screenshot ? ['screenshot'] : []),
      ],
    });
    await this.writer.recordViewerActivity(app);
    return surface;
  }

  /** Releases one experimental virtual display surface. */
  async releaseVirtualDisplay(id: string, surfaceId: string) {
    const app = await this.getRunningRuntimeApp(id);
    const surface = await this.displaySidecar.releaseVirtualSurface(
      app,
      surfaceId,
    );
    await this.writer.recordViewerActivity(app);
    return surface;
  }

  /** Loads one running app for viewer actions. */
  private async getRunningRuntimeApp(id: string) {
    // Viewer bootstrap already probes the runtime and sidecar. Avoid adding a
    // Docker reconciliation read to every iframe refresh and activity ping.
    const app = await this.queries.getStored(id);
    if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
      throw new ConflictException(
        'Application must be running before using viewer runtime tools.',
      );
    }

    return app;
  }
}
