import {
  ConflictException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DisplaySidecarApiSchemas } from '@rebroid/display-sidecar-contracts';
import {
  displaySidecarJsonHeaders,
  displaySidecarUrl,
} from '../../../common/display-sidecar-request';
import { getErrorMessage } from '../../../common/error-message';
import { MetricsService } from '../../../metrics/metrics.service';
import { AndroidApplication } from '../../android-application.entity';
import type { ApplicationViewerControlCommand } from '../../contracts/application-viewer-control';
import type { DisplaySessionDto } from '../dto/scrcpy-session.dto';
import { AndroidAppsViewerNetworkService } from './android-apps-viewer-network.service';
import { FeatureFlagsService } from '../../../feature-flags/feature-flags.service';
import {
  SIDECAR_FEATURE_SYNC,
  type SidecarFeatureSyncPort,
} from '../../../docker/contracts/sidecar-feature-sync.port';

type DisplaySessionResponse =
  DisplaySidecarApiSchemas['DisplaySessionResponseDto'];
type DisplayActionResponse =
  DisplaySidecarApiSchemas['DisplayActionAcknowledgmentDto'];
type DisplayClipboardResponse =
  DisplaySidecarApiSchemas['DisplayClipboardResultDto'];

interface CreateVirtualSurfaceInput {
  capabilities?: string[];
  name?: string;
  width?: number;
  height?: number;
  dpi?: number;
}

interface ErrorResponse {
  message?: string;
  code?: string;
}

@Injectable()
export class AndroidAppsDisplaySidecarService {
  constructor(
    private readonly config: ConfigService,
    private readonly viewerNetwork: AndroidAppsViewerNetworkService,
    private readonly features: FeatureFlagsService,
    @Inject(SIDECAR_FEATURE_SYNC)
    private readonly featureSync: SidecarFeatureSyncPort,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  /** Creates or reuses a sidecar-owned display session for an already prepared ADB target. */
  async createSessionForPreparedTarget(
    app: AndroidApplication,
    udid: string,
    capabilities = [
      'video',
      'audio',
      'control',
      'clipboard',
      'files',
      'diagnostics',
    ],
    signal?: AbortSignal,
  ): Promise<DisplaySessionDto> {
    const result = await this.request<DisplaySessionResponse>('/sessions', {
      signal,
      method: 'POST',
      body: JSON.stringify({
        appId: app.id,
        runtimeId: app.containerId ?? undefined,
        udid,
        ownerUserId: app.ownerUserId,
        capabilities,
      }),
    }).catch((error: unknown) => {
      if (!signal?.aborted) this.metrics?.managedViewerAdmission('error');
      throw error;
    });

    this.metrics?.managedViewerAdmission('success');
    return result.session;
  }

  /** Best-effort session creation used by viewer bootstrap while the sidecar is settling. */
  async tryCreateSessionForPreparedTarget(
    app: AndroidApplication,
    udid: string,
    capabilities?: string[],
  ): Promise<DisplaySessionDto | null> {
    try {
      const session = await this.createSessionForPreparedTarget(
        app,
        udid,
        capabilities,
      );
      // The sidecar loses its feature snapshot when restarted independently.
      await this.featureSync.synchronizeFeatures().catch(() => undefined);
      return session;
    } catch {
      return null;
    }
  }

  /** Executes one viewer action through the display sidecar API. */
  async viewerControl(
    app: AndroidApplication,
    command: ApplicationViewerControlCommand,
    signal?: AbortSignal,
  ) {
    const session = await this.ensureSession(app, signal);
    await this.requestAction(session.id, command, signal);
    return { session, command, executed: true };
  }

  private async requestAction(
    sessionId: string,
    command: ApplicationViewerControlCommand,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    let response: Response;
    let payload: ErrorResponse & Partial<DisplayActionResponse>;
    try {
      response = await this.fetchDisplay(
        `/sessions/${encodeURIComponent(sessionId)}/actions`,
        {
          method: 'POST',
          redirect: 'error',
          body: JSON.stringify({ command }),
        },
      );
      payload = this.parseJson(await response.text());
    } catch {
      throw this.unknownActionOutcome(command);
    }
    if (!response.ok) {
      if (
        response.status >= 500 ||
        payload.code === 'control_outcome_unknown'
      ) {
        throw this.unknownActionOutcome(command);
      }
      throw new ConflictException({
        code:
          typeof payload.code === 'string' ? payload.code : 'control_rejected',
        message:
          typeof payload.message === 'string'
            ? payload.message
            : `Display sidecar rejected control "${command}" (HTTP ${response.status}).`,
      });
    }
    if (
      payload.ok !== true ||
      payload.executed !== true ||
      payload.command !== command ||
      (payload.transport !== 'adb' && payload.transport !== 'stream-control')
    ) {
      throw this.unknownActionOutcome(command);
    }
  }

  private unknownActionOutcome(command: ApplicationViewerControlCommand) {
    return new ConflictException({
      code: 'control_outcome_unknown',
      message: `Display sidecar could not confirm whether control "${command}" executed.`,
    });
  }

  async setClipboard(app: AndroidApplication, text: string) {
    const session = await this.ensureSession(app);
    const response = await this.request<DisplayClipboardResponse>(
      `/sessions/${session.id}/clipboard`,
      {
        method: 'PUT',
        body: JSON.stringify({ text }),
      },
    );
    if (!response.session) {
      throw new ConflictException(
        'Display sidecar returned a malformed clipboard response.',
      );
    }
    return {
      session: response.session,
      text: response.text,
      supported: response.supported,
    };
  }

  async releaseSessionsForApp(appId: string) {
    if (!appId) {
      return;
    }

    await this.request(`/sessions/apps/${encodeURIComponent(appId)}`, {
      method: 'DELETE',
    });
  }

  async createVirtualSurface(
    app: AndroidApplication,
    input: CreateVirtualSurfaceInput = {},
  ) {
    this.features.assertEnabled('feature.display-virtual');
    await this.featureSync.synchronizeFeatures();
    const session = await this.ensureSession(
      app,
      undefined,
      input.capabilities ?? ['video', 'audio'],
    );
    const result = await this.request<DisplaySessionResponse>(
      `/sessions/${encodeURIComponent(session.id)}/surfaces`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          width: input.width,
          height: input.height,
          dpi: input.dpi,
        }),
      },
    );

    return result.session;
  }

  async releaseVirtualSurface(app: AndroidApplication, surfaceId: string) {
    if (!app.containerId) {
      throw new ConflictException('Application runtime is not active.');
    }
    const query = new URLSearchParams();
    if (app.ownerUserId != null) query.set('ownerUserId', app.ownerUserId);
    const owner = query.size ? `?${query.toString()}` : '';
    const application = encodeURIComponent(app.id);
    const runtime = encodeURIComponent(app.containerId);
    const surface = encodeURIComponent(surfaceId);
    return this.request<DisplaySessionDto>(
      `/sessions/apps/${application}/runtimes/${runtime}/surfaces/${surface}${owner}`,
      { method: 'DELETE' },
    );
  }

  private async ensureSession(
    app: AndroidApplication,
    signal?: AbortSignal,
    capabilities?: string[],
  ) {
    const target = await this.viewerNetwork.requireViewerTarget(app, signal);
    signal?.throwIfAborted();
    try {
      return await this.createSessionForPreparedTarget(
        app,
        target.udid,
        capabilities,
        signal,
      );
    } catch (error) {
      if (!signal?.aborted) this.viewerNetwork.invalidateViewerTarget(target);
      throw error;
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchDisplay(path, init);
    const text = await response.text();
    const payload = this.parseJson(text);
    if (!response.ok) {
      throw new ConflictException(
        payload.message ?? `Display sidecar API returned ${response.status}.`,
      );
    }

    return payload as T;
  }

  private async fetchDisplay(path: string, init: RequestInit = {}) {
    const url = displaySidecarUrl(this.config, `/rebroid/display${path}`);
    const headers = displaySidecarJsonHeaders(this.config, init);
    const timeout = AbortSignal.timeout(20_000);
    return fetch(url, {
      ...init,
      headers,
      signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    }).catch((error) => {
      throw new ConflictException(
        `Display sidecar API is not reachable: ${getErrorMessage(error)}`,
      );
    });
  }

  private parseJson(text: string): ErrorResponse {
    if (!text) {
      return {};
    }

    try {
      const payload = JSON.parse(text) as unknown;
      if (typeof payload === 'object' && payload !== null) {
        return payload as ErrorResponse;
      }
    } catch {
      return { message: text };
    }

    return {};
  }
}
