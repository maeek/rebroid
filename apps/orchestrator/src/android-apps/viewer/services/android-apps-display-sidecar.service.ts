import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getErrorMessage } from '../../../common/error-message';
import { AndroidApplication } from '../../android-application.entity';
import type { ApplicationViewerControlCommand } from '../dto/application-viewer-control.dto';
import type { DisplaySessionDto } from '../dto/scrcpy-session.dto';
import { AndroidAppsViewerNetworkService } from './android-apps-viewer-network.service';

interface DisplaySessionResponse {
  session: DisplaySessionDto;
}

interface DisplaySessionListResponse {
  items: DisplaySessionDto[];
}

interface DisplayActionResponse extends DisplaySessionResponse {
  action: ApplicationViewerControlCommand;
  executed: boolean;
}

interface DisplayClipboardResponse extends DisplaySessionResponse {
  text: string;
  supported: boolean;
}

export interface DisplayRecording {
  id: string;
  sessionId: string;
  status: 'recording' | 'stopped';
  startedAt: string;
  stoppedAt: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  sampleCount: number;
  downloadPath: string | null;
}

interface DisplayRecordingResponse {
  recording: DisplayRecording;
}

interface DisplayRecordingListResponse {
  items: DisplayRecording[];
}

interface CreateVirtualSurfaceInput {
  name?: string;
  width?: number;
  height?: number;
  dpi?: number;
}

interface ErrorResponse {
  message?: string;
}

@Injectable()
export class AndroidAppsDisplaySidecarService {
  constructor(
    private readonly config: ConfigService,
    private readonly viewerNetwork: AndroidAppsViewerNetworkService,
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
  ): Promise<DisplaySessionDto> {
    const result = await this.request<DisplaySessionResponse>('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        appId: app.id,
        udid,
        ownerUserId: app.ownerUserId,
        capabilities,
      }),
    });

    return result.session;
  }

  /** Best-effort session creation used by viewer bootstrap so legacy streaming still works. */
  async tryCreateSessionForPreparedTarget(
    app: AndroidApplication,
    udid: string,
    capabilities?: string[],
  ): Promise<DisplaySessionDto | null> {
    try {
      return await this.createSessionForPreparedTarget(app, udid, capabilities);
    } catch {
      return null;
    }
  }

  /** Executes one viewer action through the display sidecar API. */
  async viewerControl(
    app: AndroidApplication,
    command: ApplicationViewerControlCommand,
  ): Promise<DisplayActionResponse> {
    const session = await this.ensureSession(app);
    return this.request<DisplayActionResponse>(
      `/sessions/${session.id}/actions`,
      {
        method: 'POST',
        body: JSON.stringify({ action: command }),
      },
    );
  }

  async setClipboard(
    app: AndroidApplication,
    text: string,
  ): Promise<DisplayClipboardResponse> {
    const session = await this.ensureSession(app);
    return this.request<DisplayClipboardResponse>(
      `/sessions/${session.id}/clipboard`,
      {
        method: 'PUT',
        body: JSON.stringify({ text }),
      },
    );
  }

  async releaseSessionsForApp(appId: string) {
    await this.request(`/sessions/apps/${encodeURIComponent(appId)}`, {
      method: 'DELETE',
    });
  }

  async createVirtualSurface(
    app: AndroidApplication,
    input: CreateVirtualSurfaceInput = {},
  ) {
    const session = await this.getOrCreateMainSession(app);
    const result = await this.request<DisplaySessionResponse>(
      `/sessions/${encodeURIComponent(session.id)}/surfaces`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );

    return result.session;
  }

  async releaseVirtualSurface(app: AndroidApplication, surfaceId: string) {
    const surface = await this.findSurfaceSession(app, surfaceId);
    if (surface.surfaceKind === 'main') {
      throw new ConflictException('Main display surface cannot be closed.');
    }
    const parent = await this.findMainSession(app);
    return this.request<DisplaySessionDto>(
      `/sessions/${encodeURIComponent(parent.id)}/surfaces/${encodeURIComponent(surface.surfaceId)}`,
      {
        method: 'DELETE',
      },
    );
  }

  async startRecording(app: AndroidApplication, surfaceId: string) {
    const surface = await this.findSurfaceSession(app, surfaceId);
    const result = await this.request<DisplayRecordingResponse>(
      `/sessions/${encodeURIComponent(surface.id)}/recording/start`,
      { method: 'POST' },
    );

    return result.recording;
  }

  async stopRecording(app: AndroidApplication, surfaceId: string) {
    const surface = await this.findSurfaceSession(app, surfaceId);
    const result = await this.request<DisplayRecordingResponse>(
      `/sessions/${encodeURIComponent(surface.id)}/recording/stop`,
      { method: 'POST' },
    );

    return result.recording;
  }

  async downloadRecording(
    app: AndroidApplication,
    surfaceId: string,
    recordingId: string,
  ) {
    const surface = await this.findSurfaceSession(app, surfaceId);
    const recordings = await this.request<DisplayRecordingListResponse>(
      `/sessions/${encodeURIComponent(surface.id)}/recordings`,
    );
    const recording = recordings.items.find((item) => item.id === recordingId);
    if (!recording?.downloadPath) {
      throw new ConflictException('Display recording is not available.');
    }

    return {
      recording,
      response: await this.requestBinaryResponse(recording.downloadPath),
    };
  }

  private async ensureSession(app: AndroidApplication) {
    const udid = await this.prepareUdid(app);
    return this.createSessionForPreparedTarget(app, udid);
  }

  private async getOrCreateMainSession(app: AndroidApplication) {
    const existing = await this.findMainSession(app).catch(() => null);
    return existing ?? this.ensureSession(app);
  }

  private async findMainSession(app: AndroidApplication) {
    const session = (await this.listAppSessions(app)).find(
      (item) => item.surfaceKind === 'main',
    );
    if (!session) {
      throw new ConflictException('Main display session is not active.');
    }

    return session;
  }

  private async findSurfaceSession(app: AndroidApplication, surfaceId: string) {
    const sessions = await this.listAppSessions(app);
    const directSession = sessions.find(
      (session) => session.id === surfaceId || session.surfaceId === surfaceId,
    );
    if (directSession) {
      return directSession;
    }

    const surface = sessions
      .flatMap((session) => session.surfaces ?? [])
      .find((item) => item.id === surfaceId || item.sessionId === surfaceId);
    if (!surface) {
      throw new ConflictException(
        `Display surface ${surfaceId} is not active.`,
      );
    }

    return this.request<DisplaySessionResponse>(
      `/sessions/${encodeURIComponent(surface.sessionId)}`,
    ).then((result) => result.session);
  }

  private async listAppSessions(app: AndroidApplication) {
    const response =
      await this.request<DisplaySessionListResponse>('/sessions');
    return response.items.filter(
      (session) =>
        session.appId === app.id &&
        session.status !== 'released' &&
        session.status !== 'expired',
    );
  }

  private async prepareUdid(app: AndroidApplication) {
    await this.viewerNetwork.prepareNetwork(app);
    const adbHost = await this.viewerNetwork.resolveScrcpyAdbHost(app);
    const adbTarget = await this.viewerNetwork.prepareScrcpyAdbTarget(
      app,
      adbHost,
    );
    if (!adbTarget.configured || !adbTarget.connected) {
      throw new ConflictException(adbTarget.message);
    }

    return `${adbHost}:${app.adbPort}`;
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

  private async requestBinaryResponse(path: string): Promise<Response> {
    const response = await this.fetchDisplay(path);
    if (!response.ok) {
      const payload = this.parseJson(await response.text());
      throw new ConflictException(
        payload.message ?? `Display sidecar API returned ${response.status}.`,
      );
    }

    return response;
  }

  private async fetchDisplay(path: string, init: RequestInit = {}) {
    const baseUrl = this.config
      .getOrThrow<string>('app.displaySidecar.internalBaseUrl')
      .replace(/\/$/, '');
    const secret = this.config.get<string>('app.sharedSecret');
    const normalizedPath = path.startsWith('/rebroid/display')
      ? path
      : `/rebroid/display${path}`;
    return fetch(`${baseUrl}${normalizedPath}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(secret ? { 'x-rebroid-sidecar-secret': secret } : {}),
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
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
