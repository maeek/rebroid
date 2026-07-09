import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setTimeout as delay } from 'node:timers/promises';
import { getErrorMessage } from '../../../common/error-message';
import { ViewerTargetStatus } from '../../../docker/docker.types';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import type { ApplicationViewerControlCommand } from '../../contracts/application-viewer-control';
import { ScrcpySessionDto } from '../dto/scrcpy-session.dto';
import { AndroidAppsDisplaySidecarService } from './android-apps-display-sidecar.service';
import { AndroidAppsViewerNetworkService } from './android-apps-viewer-network.service';

type PreparedViewerTarget = {
  adbHost: string;
  viewerTarget: ViewerTargetStatus;
};

@Injectable()
export class AndroidAppsViewerService {
  private static readonly viewerTargetReadyCacheTtlMs = 10_000;
  private readonly logger = new Logger(AndroidAppsViewerService.name);
  private readonly viewerTargetPreparations = new Map<
    string,
    Promise<PreparedViewerTarget>
  >();
  private readonly viewerTargetReadyCache = new Map<
    string,
    {
      expiresAt: number;
      result: PreparedViewerTarget;
    }
  >();

  constructor(
    private readonly config: ConfigService,
    private readonly displaySidecar: AndroidAppsDisplaySidecarService,
    private readonly logs: AndroidAppsLogService,
    private readonly state: AndroidAppsStateService,
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
              ...(access.screenshot ? ['screenshot'] : []),
            ],
          )
        : null;
    if (displaySession) {
      this.cachePreparedViewerTarget(
        app,
        { adbHost, viewerTarget },
        displaySession.expiresAt,
      );
    } else {
      this.invalidatePreparedViewerTarget(app, 'display-session-unavailable');
    }
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

  /** Coalesces concurrent viewer refreshes while the sidecar target is settling. */
  private async prepareViewerTarget(
    app: Awaited<ReturnType<AndroidAppsViewerService['getRunningRuntimeApp']>>,
  ) {
    const key = this.viewerTargetCacheKey(app);
    const cached = this.viewerTargetReadyCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      this.logger.debug(
        `Using cached display sidecar target for ${app.id}; adbHost=${cached.result.adbHost}`,
      );
      this.appendViewerLog(app, 'Display sidecar target reused', {
        adbHost: cached.result.adbHost,
        adbPort: app.adbPort,
        containerId: app.containerId,
        cacheExpiresAt: new Date(cached.expiresAt).toISOString(),
      });
      return cached.result;
    }
    this.viewerTargetReadyCache.delete(key);

    const existing = this.viewerTargetPreparations.get(key);
    if (existing) {
      return existing;
    }

    const pending = this.prepareViewerTargetOnce(app)
      .then((result) => {
        if (result.viewerTarget.connected) {
          this.viewerTargetReadyCache.set(key, {
            expiresAt:
              Date.now() + AndroidAppsViewerService.viewerTargetReadyCacheTtlMs,
            result,
          });
        } else {
          this.viewerTargetReadyCache.delete(key);
        }
        return result;
      })
      .finally(() => {
        if (this.viewerTargetPreparations.get(key) === pending) {
          this.viewerTargetPreparations.delete(key);
        }
      });
    this.viewerTargetPreparations.set(key, pending);
    return pending;
  }

  private cachePreparedViewerTarget(
    app: Awaited<ReturnType<AndroidAppsViewerService['getRunningRuntimeApp']>>,
    result: PreparedViewerTarget,
    expiresAt: string,
  ) {
    if (!result.viewerTarget.connected) {
      this.invalidatePreparedViewerTarget(app, 'viewer-target-disconnected');
      return;
    }

    const sessionExpiresAt = Date.parse(expiresAt);
    const fallbackExpiresAt =
      Date.now() + AndroidAppsViewerService.viewerTargetReadyCacheTtlMs;
    const cacheExpiresAt =
      Number.isFinite(sessionExpiresAt) && sessionExpiresAt > Date.now()
        ? sessionExpiresAt
        : fallbackExpiresAt;
    this.viewerTargetReadyCache.set(this.viewerTargetCacheKey(app), {
      expiresAt: cacheExpiresAt,
      result,
    });
    this.appendViewerLog(app, 'Display sidecar target cached', {
      adbHost: result.adbHost,
      adbPort: app.adbPort,
      containerId: app.containerId,
      cacheExpiresAt: new Date(cacheExpiresAt).toISOString(),
    });
  }

  private invalidatePreparedViewerTarget(
    app: Awaited<ReturnType<AndroidAppsViewerService['getRunningRuntimeApp']>>,
    reason: string,
  ) {
    this.viewerTargetReadyCache.delete(this.viewerTargetCacheKey(app));
    this.appendViewerLog(app, 'Display sidecar target cache invalidated', {
      adbPort: app.adbPort,
      containerId: app.containerId,
      reason,
    });
  }

  private viewerTargetCacheKey(
    app: Awaited<ReturnType<AndroidAppsViewerService['getRunningRuntimeApp']>>,
  ) {
    return `${app.id}:${app.containerId ?? app.containerName}:${app.adbPort}`;
  }

  private appendViewerLog(
    app: Awaited<ReturnType<AndroidAppsViewerService['getRunningRuntimeApp']>>,
    message: string,
    context: unknown,
  ) {
    void this.logs.append(app.id, message, context).catch((error) => {
      this.logger.debug(
        `Could not append viewer cache log for ${app.id}: ${getErrorMessage(error)}`,
      );
    });
  }

  /** Retries the lazy sidecar attachment while a freshly started runtime settles. */
  private async prepareViewerTargetOnce(
    app: Awaited<ReturnType<AndroidAppsViewerService['getRunningRuntimeApp']>>,
  ) {
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
    await this.displaySidecar.viewerControl(app, command);
    await this.recordViewerActivity(id);

    return {
      command,
      executed: true,
      message: 'Viewer control command executed through display sidecar.',
    };
  }

  /** Creates or reuses the app's single experimental virtual display surface. */
  async createVirtualDisplay(id: string) {
    const app = await this.getRunningRuntimeApp(id);
    const surface = await this.displaySidecar.createVirtualSurface(app, {
      name: 'Virtual display',
      width: 1280,
      height: 720,
      dpi: 160,
    });
    await this.recordViewerActivity(id);
    return surface;
  }

  /** Releases one experimental virtual display surface. */
  async releaseVirtualDisplay(id: string, surfaceId: string) {
    const app = await this.getRunningRuntimeApp(id);
    const surface = await this.displaySidecar.releaseVirtualSurface(
      app,
      surfaceId,
    );
    await this.recordViewerActivity(id);
    return surface;
  }

  /** Starts recording one display surface. */
  async startRecording(id: string, surfaceId: string) {
    const app = await this.getRunningRuntimeApp(id);
    const recording = await this.displaySidecar.startRecording(app, surfaceId);
    await this.recordViewerActivity(id);
    return recording;
  }

  /** Stops recording one display surface and returns a downloadable data URL. */
  async stopRecording(id: string, surfaceId: string) {
    const app = await this.getRunningRuntimeApp(id);
    const recording = await this.displaySidecar.stopRecording(app, surfaceId);
    await this.recordViewerActivity(id);
    return recording;
  }

  /** Downloads one completed display recording after validating the app surface. */
  async downloadRecording(id: string, surfaceId: string, recordingId: string) {
    const app = await this.getRunningRuntimeApp(id);
    const recording = await this.displaySidecar.downloadRecording(
      app,
      surfaceId,
      recordingId,
    );
    await this.recordViewerActivity(id);
    return recording;
  }

  /** Loads one running app for viewer actions. */
  private async getRunningRuntimeApp(id: string) {
    // Viewer bootstrap already probes the runtime and sidecar. Avoid adding a
    // Docker reconciliation read to every iframe refresh and activity ping.
    const app = await this.state.getStored(id);
    if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
      throw new ConflictException(
        'Application must be running before using viewer runtime tools.',
      );
    }

    return app;
  }
}
