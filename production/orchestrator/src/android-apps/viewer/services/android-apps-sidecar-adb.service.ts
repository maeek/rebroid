import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getErrorMessage } from '../../../common/error-message';
import { AndroidApplication } from '../../android-application.entity';
import { parseAndroidNotifications } from '../../runtime/utils/android-apps-notification.utils';
import type { ApplicationViewerControlCommand } from '../dto/application-viewer-control.dto';
import { AndroidAppsViewerNetworkService } from './android-apps-viewer-network.service';

@Injectable()
export class AndroidAppsSidecarAdbService {
  constructor(
    private readonly config: ConfigService,
    private readonly viewerNetwork: AndroidAppsViewerNetworkService,
  ) {}

  async viewerControl(
    app: AndroidApplication,
    command: ApplicationViewerControlCommand,
  ) {
    return this.request(app, '/control', {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
  }

  async getClipboard(app: AndroidApplication) {
    return this.request<{ text: string; supported: boolean }>(
      app,
      '/clipboard',
    );
  }

  async setClipboard(app: AndroidApplication, text: string) {
    return this.request<{ text: string; supported: boolean }>(
      app,
      '/clipboard',
      {
        method: 'PUT',
        body: JSON.stringify({ text }),
      },
    );
  }

  async logcat(app: AndroidApplication, tail: number) {
    return this.request<{ source: 'adb'; collectedAt: string; output: string }>(
      app,
      `/logcat?tail=${Math.max(1, Math.min(tail, 2000))}`,
    );
  }

  async notifications(app: AndroidApplication) {
    const result = await this.request<{ output: string }>(app, '/notifications');
    return parseAndroidNotifications(result.output);
  }

  async screenshot(app: AndroidApplication) {
    return this.request<{
      mimeType: string;
      dataUrl: string;
      capturedAt: string;
    }>(app, '/screenshot');
  }

  private async request<T = unknown>(
    app: AndroidApplication,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const udid = await this.prepareUdid(app);
    const baseUrl = this.config
      .getOrThrow<string>('app.displaySidecar.internalBaseUrl')
      .replace(/\/$/, '');
    const secret = this.config.get<string>('app.sharedSecret');
    const response = await fetch(
      `${baseUrl}/rebroid/adb/${encodeURIComponent(udid)}${path}`,
      {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(secret ? { 'x-rebroid-sidecar-secret': secret } : {}),
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(20_000),
      },
    ).catch((error) => {
      throw new ConflictException(
        `Display sidecar ADB API is not reachable: ${getErrorMessage(error)}`,
      );
    });

    const text = await response.text();
    let payload: (T & { message?: string }) | null = null;
    try {
      payload = text ? (JSON.parse(text) as T & { message?: string }) : null;
    } catch {
      payload = { message: text } as T & { message?: string };
    }
    if (!response.ok) {
      throw new ConflictException(
        payload?.message ??
          `Display sidecar ADB API returned ${response.status}.`,
      );
    }

    return payload as T;
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
}
