import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getErrorMessage } from '../../../common/error-message';
import { AndroidApplication } from '../../android-application.entity';
import { parseAndroidNotifications } from '../../runtime/utils/android-apps-notification.utils';
import { AndroidAppsViewerNetworkService } from './android-apps-viewer-network.service';

@Injectable()
export class AndroidAppsSidecarAdbService {
  private readonly preparedTargets = new Map<
    string,
    { udid: string; expiresAt: number }
  >();

  constructor(
    private readonly config: ConfigService,
    private readonly viewerNetwork: AndroidAppsViewerNetworkService,
  ) {}

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

  async tap(app: AndroidApplication, x: number, y: number) {
    return this.request<{ executed: boolean }>(app, '/tap', {
      method: 'POST',
      body: JSON.stringify({ x, y }),
    });
  }

  async swipe(
    app: AndroidApplication,
    input: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      durationMs: number;
    },
  ) {
    return this.request<{ executed: boolean }>(app, '/swipe', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async inputText(app: AndroidApplication, text: string) {
    return this.request<{ executed: boolean }>(app, '/input-text', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async key(app: AndroidApplication, key: string) {
    return this.request<{ executed: boolean }>(app, '/key', {
      method: 'POST',
      body: JSON.stringify({ key }),
    });
  }

  async rotateDisplay(
    app: AndroidApplication,
    orientation:
      | 'portrait'
      | 'landscape'
      | 'reverse-portrait'
      | 'reverse-landscape',
  ) {
    return this.request<{ executed: boolean }>(app, '/rotate-display', {
      method: 'POST',
      body: JSON.stringify({ orientation }),
    });
  }

  async shell(app: AndroidApplication, command: string, timeoutMs: number) {
    return this.request<{
      stdout: string;
      stderr: string;
      exitCode: number;
    }>(app, '/shell', {
      method: 'POST',
      body: JSON.stringify({ command, timeoutMs }),
    });
  }

  async dumpUi(app: AndroidApplication) {
    return this.request<{
      status: 'available' | 'failed';
      xml?: string;
      error?: string;
      dumpedAt: string;
      diagnostics?: {
        command: string;
        compressed: boolean;
        durationMs: number;
        exitCode: number | null;
        stdout: string;
        stderr: string;
        xmlBytes: number;
        rawNodeCount: number;
      };
      attempts?: Array<{
        command: string;
        compressed: boolean;
        durationMs: number;
        exitCode: number | null;
        stdout: string;
        stderr: string;
        xmlBytes: number;
        rawNodeCount: number;
      }>;
    }>(app, '/ui-dump');
  }

  async tapText(app: AndroidApplication, text: string) {
    return this.request<{ found: boolean; x: number | null; y: number | null }>(
      app,
      '/tap-text',
      {
        method: 'POST',
        body: JSON.stringify({ text }),
      },
    );
  }

  async pushFile(app: AndroidApplication, path: string, contentBase64: string) {
    return this.request<{ pushed: boolean }>(app, '/files', {
      method: 'PUT',
      body: JSON.stringify({ path, contentBase64 }),
    });
  }

  async pullFile(app: AndroidApplication, path: string) {
    return this.request<{
      path: string;
      contentBase64: string;
      sizeBytes: number;
    }>(app, `/files?path=${encodeURIComponent(path)}`);
  }

  async deleteFile(app: AndroidApplication, path: string) {
    return this.request<{ deleted: boolean }>(app, '/files', {
      method: 'DELETE',
      body: JSON.stringify({ path }),
    });
  }

  async fileExists(app: AndroidApplication, path: string) {
    const result = await this.request<{ exists: boolean }>(
      app,
      `/files/exists?path=${encodeURIComponent(path)}`,
    );
    return result.exists;
  }

  async listFiles(app: AndroidApplication, path: string) {
    const result = await this.request<{ files: string[] }>(
      app,
      `/files/list?path=${encodeURIComponent(path)}`,
    );
    return result.files;
  }

  async logcat(app: AndroidApplication, tail: number) {
    return this.request<{ source: 'adb'; collectedAt: string; output: string }>(
      app,
      `/logcat?tail=${Math.max(1, Math.min(tail, 2000))}`,
    );
  }

  async notifications(app: AndroidApplication) {
    const result = await this.request<{ output: string }>(
      app,
      '/notifications',
    );
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
    const cacheKey = this.targetCacheKey(app);
    const udid = await this.prepareUdid(app, cacheKey);
    const baseUrl = this.config
      .getOrThrow<string>('app.displaySidecar.internalBaseUrl')
      .replace(/\/$/, '');
    const secret = this.config.get<string>('app.sharedSecret');
    const hasBody =
      init.body !== undefined &&
      init.body !== null &&
      `${init.body}`.length > 0;
    const headers = new Headers(init.headers);
    if (hasBody && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    if (secret) {
      headers.set('x-rebroid-sidecar-secret', secret);
    }
    const response = await fetch(
      `${baseUrl}/rebroid/adb/${encodeURIComponent(udid)}${path}`,
      {
        ...init,
        headers,
        signal: AbortSignal.timeout(20_000),
      },
    ).catch((error) => {
      this.preparedTargets.delete(cacheKey);
      throw new ConflictException(
        `Display sidecar ADB API is not reachable: ${getErrorMessage(error)}`,
      );
    });

    const text = await response.text();
    let payload: (T & { message?: string }) | null;
    try {
      payload = text ? (JSON.parse(text) as T & { message?: string }) : null;
    } catch {
      payload = { message: text } as T & { message?: string };
    }
    if (!response.ok) {
      this.preparedTargets.delete(cacheKey);
      throw new ConflictException(
        payload?.message ??
          `Display sidecar ADB API returned ${response.status}.`,
      );
    }

    return payload as T;
  }

  private async prepareUdid(app: AndroidApplication, cacheKey: string) {
    const cached = this.preparedTargets.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.udid;
    }

    await this.viewerNetwork.prepareNetwork(app);
    const adbHost = await this.viewerNetwork.resolveScrcpyAdbHost(app);
    const adbTarget = await this.viewerNetwork.prepareScrcpyAdbTarget(
      app,
      adbHost,
    );
    if (!adbTarget.configured || !adbTarget.connected) {
      throw new ConflictException(adbTarget.message);
    }

    const udid = `${adbHost}:${app.adbPort}`;
    for (const key of this.preparedTargets.keys()) {
      if (key.startsWith(`${app.id}:`) && key !== cacheKey) {
        this.preparedTargets.delete(key);
      }
    }
    this.preparedTargets.set(cacheKey, {
      udid,
      expiresAt: Date.now() + 60_000,
    });
    return udid;
  }

  private targetCacheKey(app: AndroidApplication) {
    return [
      app.id,
      app.containerId ?? 'no-container',
      app.containerName,
      app.networkName,
      app.adbPort,
    ].join(':');
  }
}
