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

interface DisplayActionResponse extends DisplaySessionResponse {
  action: ApplicationViewerControlCommand;
  executed: boolean;
}

interface DisplayClipboardResponse extends DisplaySessionResponse {
  text: string;
  supported: boolean;
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
  ): Promise<DisplaySessionDto> {
    const result = await this.request<DisplaySessionResponse>('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        appId: app.id,
        udid,
        ownerUserId: app.ownerUserId,
        capabilities: ['video', 'control', 'clipboard', 'files', 'diagnostics'],
      }),
    });

    return result.session;
  }

  /** Best-effort session creation used by viewer bootstrap so legacy streaming still works. */
  async tryCreateSessionForPreparedTarget(
    app: AndroidApplication,
    udid: string,
  ): Promise<DisplaySessionDto | null> {
    try {
      return await this.createSessionForPreparedTarget(app, udid);
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

  private async ensureSession(app: AndroidApplication) {
    const udid = await this.prepareUdid(app);
    return this.createSessionForPreparedTarget(app, udid);
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
    const baseUrl = this.config
      .getOrThrow<string>('app.displaySidecar.internalBaseUrl')
      .replace(/\/$/, '');
    const secret = this.config.get<string>('app.sharedSecret');
    const response = await fetch(`${baseUrl}/rebroid/display${path}`, {
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

    const text = await response.text();
    const payload = this.parseJson(text);
    if (!response.ok) {
      throw new ConflictException(
        payload.message ?? `Display sidecar API returned ${response.status}.`,
      );
    }

    return payload as T;
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
