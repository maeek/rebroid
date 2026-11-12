import { randomUUID } from 'node:crypto';
import { addAbortListener } from 'node:events';
import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DisplaySidecarApiSchemas } from '@rebroid/display-sidecar-contracts';
import { z } from 'zod';
import { getErrorMessage } from '../../../common/error-message';
import { waitForOperation } from '../../../common/wait-for-operation';
import { AndroidApplication } from '../../android-application.entity';
import type {
  AndroidAutomationUiTextInput,
  AndroidAutomationUiTextResult,
  AndroidAutomationTarget,
} from '../../contracts/android-apps-automation.port';
import { parseAndroidNotifications } from '../../runtime/utils/android-apps-notification.utils';
import { AndroidAppsViewerNetworkService } from './android-apps-viewer-network.service';

const uiTextResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('found'),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
  }),
  z.object({
    status: z.enum([
      'not_found',
      'hierarchy_unavailable',
      'tap_outcome_unknown',
    ]),
  }),
]);

interface AdbRequestOptions extends RequestInit {
  requestTimeoutMs?: number;
  awaitMutation?: boolean;
}

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

  async getClipboard(app: AndroidApplication, signal?: AbortSignal) {
    return this.request<{ text: string; supported: boolean }>(
      app,
      '/clipboard',
      { signal },
    );
  }

  async setClipboard(
    app: AndroidApplication,
    text: string,
    signal?: AbortSignal,
  ) {
    return this.request<{ text: string; supported: boolean }>(
      app,
      '/clipboard',
      {
        signal,
        method: 'PUT',
        body: JSON.stringify({ text }),
        awaitMutation: true,
      },
    );
  }

  async tap(
    app: AndroidApplication,
    x: number,
    y: number,
    signal?: AbortSignal,
  ) {
    return this.executeInput(app, '/tap', { x, y }, signal);
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
    signal?: AbortSignal,
  ) {
    return this.executeInput(app, '/swipe', input, signal);
  }

  async inputText(app: AndroidApplication, text: string, signal?: AbortSignal) {
    return this.executeInput(app, '/input-text', { text }, signal);
  }

  async key(app: AndroidApplication, key: string, signal?: AbortSignal) {
    return this.executeInput(app, '/key', { key }, signal);
  }

  async rotateDisplay(
    app: AndroidApplication,
    orientation:
      'portrait' | 'landscape' | 'reverse-portrait' | 'reverse-landscape',
    signal?: AbortSignal,
  ) {
    return this.executeInput(app, '/rotate-display', { orientation }, signal);
  }

  async shell(
    app: AndroidApplication,
    command: string,
    timeoutMs: number,
    signal?: AbortSignal,
    deadline?: number,
  ) {
    signal?.throwIfAborted();
    const cacheKey = this.targetCacheKey(app);
    const udid = await this.prepareUdid(app, cacheKey);
    signal?.throwIfAborted();
    const budget =
      deadline === undefined
        ? timeoutMs
        : Math.min(timeoutMs, Math.floor(deadline - Date.now()));
    if (budget <= 0) {
      throw new DOMException('ADB command deadline reached.', 'TimeoutError');
    }
    return this.requestPrepared<{
      stdout: string;
      stderr: string;
      exitCode: number;
    }>(udid, cacheKey, '/shell', {
      signal,
      method: 'POST',
      body: JSON.stringify({ command, timeoutMs: budget }),
      requestTimeoutMs:
        deadline === undefined
          ? Math.max(20_000, budget + 2_000)
          : budget + 2_000,
      awaitMutation: true,
    });
  }

  async dumpUi(app: AndroidApplication, signal?: AbortSignal) {
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
    }>(app, '/ui-dump', { signal });
  }

  async uiText(
    app: AndroidApplication,
    input: AndroidAutomationUiTextInput,
    runSignal?: AbortSignal,
  ): Promise<AndroidAutomationUiTextResult> {
    const deadline = performance.now() + input.timeoutMs;
    const timeout = AbortSignal.timeout(input.timeoutMs);
    const signal = runSignal ? AbortSignal.any([runSignal, timeout]) : timeout;
    const timedOut = () =>
      new DOMException('UI text request timed out.', 'TimeoutError');
    signal.throwIfAborted();
    const cacheKey = this.targetCacheKey(app);
    const udid = await this.prepareUdid(app, cacheKey, signal);
    signal.throwIfAborted();
    const remaining = Math.floor(deadline - performance.now());
    if (remaining <= 0) throw timedOut();

    const operationId = input.operation === 'tap' ? randomUUID() : undefined;
    const payload = {
      ...input,
      timeoutMs: remaining,
      ...(operationId ? { operationId } : {}),
    } satisfies DisplaySidecarApiSchemas['AdbUiTextDto'];
    const request = this.requestPrepared(udid, cacheKey, '/ui-text', {
      signal,
      method: 'POST',
      redirect: 'error',
      requestTimeoutMs: remaining + (operationId ? 2_000 : 0),
      awaitMutation: operationId !== undefined,
      body: JSON.stringify(payload),
    });
    // Cancel the sidecar poll without dropping the response that confirms it settled.
    const cancel = operationId
      ? addAbortListener(signal, () => {
          void this.requestPrepared(udid, cacheKey, `/ui-text/${operationId}`, {
            method: 'DELETE',
            redirect: 'error',
            requestTimeoutMs: 2_000,
          }).catch(() => undefined);
        })
      : undefined;
    try {
      const response = await (operationId
        ? request
        : waitForOperation(request, signal));
      if (operationId) {
        runSignal?.throwIfAborted();
      } else {
        signal.throwIfAborted();
        if (performance.now() >= deadline) throw timedOut();
      }
      const parsed = uiTextResponseSchema.safeParse(response);
      if (!parsed.success) {
        throw new ConflictException(
          'Display sidecar returned a malformed UI text response.',
        );
      }
      return parsed.data;
    } catch (error) {
      signal.throwIfAborted();
      throw error;
    } finally {
      cancel?.[Symbol.dispose]();
    }
  }

  async pushFile(
    app: AndroidApplication,
    path: string,
    contentBase64: string,
    signal?: AbortSignal,
  ) {
    return this.request<{ pushed: boolean }>(app, '/files', {
      method: 'PUT',
      body: JSON.stringify({ path, contentBase64 }),
      requestTimeoutMs: 35_000,
      awaitMutation: true,
      signal,
    });
  }

  async pullFile(app: AndroidApplication, path: string, signal?: AbortSignal) {
    return this.request<{
      path: string;
      contentBase64: string;
      sizeBytes: number;
    }>(app, `/files?path=${encodeURIComponent(path)}`, { signal });
  }

  async deleteFile(
    app: AndroidApplication,
    path: string,
    signal?: AbortSignal,
  ) {
    return this.request<{ deleted: boolean }>(app, '/files', {
      method: 'DELETE',
      body: JSON.stringify({ path }),
      awaitMutation: true,
      signal,
    });
  }

  async fileExists(
    app: AndroidApplication,
    path: string,
    signal?: AbortSignal,
  ) {
    const result = await this.request<{ exists?: unknown } | null>(
      app,
      `/files/exists?path=${encodeURIComponent(path)}`,
      { signal },
    );
    if (typeof result?.exists !== 'boolean') {
      throw new ConflictException(
        'Display sidecar returned a malformed file existence response.',
      );
    }
    return result.exists;
  }

  async listFiles(app: AndroidApplication, path: string, signal?: AbortSignal) {
    const result = await this.request<{ files: string[] }>(
      app,
      `/files/list?path=${encodeURIComponent(path)}`,
      { signal },
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

  async screenshot(app: AndroidApplication, signal?: AbortSignal) {
    return this.request<{
      mimeType: string;
      dataUrl: string;
      capturedAt: string;
    }>(app, '/screenshot', { signal });
  }

  private async executeInput(
    app: AndroidApplication,
    path: string,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ) {
    const result = await this.request<{ executed?: unknown } | null>(
      app,
      path,
      {
        signal,
        method: 'POST',
        body: JSON.stringify(input),
        awaitMutation: true,
      },
    );
    if (result?.executed !== true) {
      throw new ConflictException(
        'Display sidecar did not confirm the ADB input command.',
      );
    }
    return { executed: true };
  }

  private async request<T = unknown>(
    app: AndroidApplication,
    path: string,
    options: AdbRequestOptions = {},
  ): Promise<T> {
    options.signal?.throwIfAborted();
    const cacheKey = this.targetCacheKey(app);
    const udid = await this.prepareUdid(app, cacheKey);
    return this.requestPrepared(udid, cacheKey, path, options);
  }

  private async requestPrepared<T = unknown>(
    udid: string,
    cacheKey: string,
    path: string,
    {
      requestTimeoutMs = 20_000,
      awaitMutation = false,
      ...init
    }: AdbRequestOptions,
  ): Promise<T> {
    init.signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(requestTimeoutMs);
    const body = init.body;
    const baseUrl = this.config
      .getOrThrow<string>('app.displaySidecar.internalBaseUrl')
      .replace(/\/$/, '');
    const secret = this.config.get<string>('app.sharedSecret');
    const hasBody = body !== undefined && body !== null && `${body}`.length > 0;
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
        body,
        headers,
        // Once sent, a mutation holds its admission until acknowledgement or transport failure.
        signal:
          init.signal && !awaitMutation
            ? AbortSignal.any([init.signal, timeout])
            : timeout,
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

  private async prepareUdid(
    app: AndroidApplication,
    cacheKey: string,
    signal?: AbortSignal,
  ) {
    const cached = this.preparedTargets.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.udid;
    }

    await this.viewerNetwork.prepareNetwork(app);
    signal?.throwIfAborted();
    const adbHost = await this.viewerNetwork.resolveScrcpyAdbHost(app);
    signal?.throwIfAborted();
    const adbTarget = await this.viewerNetwork.prepareScrcpyAdbTarget(
      app,
      adbHost,
    );
    signal?.throwIfAborted();
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

  private targetCacheKey(
    app: AndroidApplication &
      Partial<Pick<AndroidAutomationTarget, 'containerStartedAt'>>,
  ) {
    return [
      app.id,
      app.containerId ?? 'no-container',
      app.containerName,
      app.networkName,
      app.adbPort,
      app.lastStartedAt?.getTime() ?? 'no-start',
      app.containerStartedAt ?? '',
    ].join(':');
  }
}
