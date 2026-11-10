import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setTimeout as delay } from 'node:timers/promises';
import { getErrorMessage } from '../../../common/error-message';
import { ViewerTargetStatus } from '../../../docker/docker.types';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import type { ApplicationViewerControlCommand } from '../../contracts/application-viewer-control';
import { ScrcpySessionDto } from '../dto/scrcpy-session.dto';
import { AndroidAppsDisplaySidecarService } from './android-apps-display-sidecar.service';
import {
  AndroidAppsViewerNetworkService,
  ViewerRuntimeChangedError,
} from './android-apps-viewer-network.service';

type PreparedViewerTarget = {
  adbHost: string;
  viewerTarget: ViewerTargetStatus;
};

type ViewerTargetEntry = {
  fingerprint: string;
  pending?: Promise<PreparedViewerTarget>;
  ready?: { expiresAt: number; result: PreparedViewerTarget };
};

@Injectable()
export class AndroidAppsViewerService {
  private static readonly viewerTargetReadyCacheTtlMs = 10_000;
  private readonly logger = new Logger(AndroidAppsViewerService.name);
  private readonly viewerTargets = new Map<string, ViewerTargetEntry>();

  constructor(
    private readonly config: ConfigService,
    private readonly displaySidecar: AndroidAppsDisplaySidecarService,
    private readonly logs: AndroidAppsLogService,
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
    const { entry, result } = await this.prepareViewerTarget(app);
    const { adbHost, viewerTarget } = result;
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
    if (this.viewerTargets.get(app.id) === entry && displaySession) {
      this.cachePreparedViewerTarget(
        app,
        entry,
        result,
        displaySession.expiresAt,
      );
    } else if (this.viewerTargets.get(app.id) === entry) {
      this.invalidatePreparedViewerTarget(
        app,
        entry,
        'display-session-unavailable',
      );
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

  /** Coalesces concurrent viewer refreshes while the sidecar target is settling. */
  private async prepareViewerTarget(
    app: Awaited<ReturnType<AndroidAppsViewerService['getRunningRuntimeApp']>>,
  ) {
    const fingerprint = this.viewerTargetFingerprint(app);
    const previous = this.viewerTargets.get(app.id);
    const entry: ViewerTargetEntry =
      previous?.fingerprint === fingerprint ? previous : { fingerprint };
    if (entry !== previous) this.viewerTargets.set(app.id, entry);

    const cached = entry.ready;
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
      return { entry, result: cached.result };
    }
    entry.ready = undefined;

    entry.pending ??= this.prepareViewerTargetOnce(app)
      .then((result) => {
        if (result.viewerTarget.connected) {
          entry.ready = {
            expiresAt:
              Date.now() + AndroidAppsViewerService.viewerTargetReadyCacheTtlMs,
            result,
          };
        }
        return result;
      })
      .finally(() => {
        entry.pending = undefined;
      });
    return { entry, result: await entry.pending };
  }

  private cachePreparedViewerTarget(
    app: Awaited<ReturnType<AndroidAppsViewerService['getRunningRuntimeApp']>>,
    entry: ViewerTargetEntry,
    result: PreparedViewerTarget,
    expiresAt: string,
  ) {
    const sessionExpiresAt = Date.parse(expiresAt);
    const fallbackExpiresAt =
      Date.now() + AndroidAppsViewerService.viewerTargetReadyCacheTtlMs;
    const cacheExpiresAt =
      Number.isFinite(sessionExpiresAt) && sessionExpiresAt > Date.now()
        ? sessionExpiresAt
        : fallbackExpiresAt;
    entry.ready = {
      expiresAt: cacheExpiresAt,
      result,
    };
    this.appendViewerLog(app, 'Display sidecar target cached', {
      adbHost: result.adbHost,
      adbPort: app.adbPort,
      containerId: app.containerId,
      cacheExpiresAt: new Date(cacheExpiresAt).toISOString(),
    });
  }

  private invalidatePreparedViewerTarget(
    app: Awaited<ReturnType<AndroidAppsViewerService['getRunningRuntimeApp']>>,
    entry: ViewerTargetEntry,
    reason: string,
  ) {
    entry.ready = undefined;
    this.appendViewerLog(app, 'Display sidecar target cache invalidated', {
      adbPort: app.adbPort,
      containerId: app.containerId,
      reason,
    });
  }

  private viewerTargetFingerprint(
    app: Awaited<ReturnType<AndroidAppsViewerService['getRunningRuntimeApp']>>,
  ) {
    return JSON.stringify([
      app.id,
      app.containerId,
      app.networkName,
      app.lastStartedAt,
      app.networkPolicyRevision,
      app.adbPort,
    ]);
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
            retryable: !(error instanceof ViewerRuntimeChangedError),
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
