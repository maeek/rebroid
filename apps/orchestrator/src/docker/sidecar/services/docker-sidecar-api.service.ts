import {
  BadGatewayException,
  ConflictException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DisplaySidecarApiSchemas } from '@rebroid/display-sidecar-contracts';
import { setTimeout as delay } from 'node:timers/promises';
import { DockerEngineService } from '../../docker-engine.service';
import { OperationDeadline } from '../../../common/operation-deadline';
import type { DockerOperationOptions } from '../../contracts/docker-operation-options';
import { FeatureFlagsService } from '../../../feature-flags/feature-flags.service';
import type { SidecarFeatureSyncPort } from '../../contracts/sidecar-feature-sync.port';

const describeHealthProbeFailure = (error: unknown) => {
  if (!(error instanceof Error)) return 'Health check failed.';
  if (error.name === 'TimeoutError') return 'Health check timed out.';
  const cause = error.cause;
  const failures = cause instanceof AggregateError ? cause.errors : [cause];
  const codes = failures.flatMap((failure: unknown) =>
    failure instanceof Error && 'code' in failure ? [failure.code] : [],
  );
  if (codes.includes('ENOTFOUND') || codes.includes('EAI_AGAIN')) {
    return 'Sidecar hostname could not be resolved.';
  }
  if (codes.includes('ECONNREFUSED')) return 'Connection was refused.';
  if (
    codes.includes('ETIMEDOUT') ||
    codes.includes('UND_ERR_CONNECT_TIMEOUT')
  ) {
    return 'Health check timed out.';
  }
  if (codes.includes('ECONNRESET') || codes.includes('UND_ERR_SOCKET')) {
    return 'Connection closed during the health check.';
  }
  return 'Health check could not connect.';
};

type DisplaySidecarSession =
  DisplaySidecarApiSchemas['DisplaySessionInventoryItemDto'];
type DisplaySidecarSessionListResponse =
  DisplaySidecarApiSchemas['DisplaySessionInventoryDto'];

@Injectable()
export class DockerSidecarApiService
  implements SidecarFeatureSyncPort, OnModuleInit, OnModuleDestroy
{
  private unsubscribeFeatures?: () => void;

  constructor(
    private readonly config: ConfigService,
    private readonly engine: DockerEngineService,
    private readonly features: FeatureFlagsService,
  ) {}

  onModuleInit() {
    this.unsubscribeFeatures = this.features.subscribe(() => {
      void this.synchronizeFeatures().catch(() => undefined);
    });
  }

  onModuleDestroy() {
    this.unsubscribeFeatures?.();
  }

  async listDisplaySessions() {
    const response = await this.request<unknown>('/sessions/inventory').catch(
      (error: unknown) => {
        if (!(error instanceof ConflictException)) throw error;
        throw new BadGatewayException(
          {
            statusCode: 502,
            code: 'display_sidecar_unavailable',
            message: error.message,
          },
          { cause: error },
        );
      },
    );
    if (
      !response ||
      typeof response !== 'object' ||
      !Array.isArray((response as DisplaySidecarSessionListResponse).items) ||
      !(response as DisplaySidecarSessionListResponse).items.every((session) =>
        this.isDisplaySession(session),
      )
    ) {
      throw new BadGatewayException({
        statusCode: 502,
        code: 'display_sidecar_invalid_response',
        message: 'Display sidecar returned a malformed session list.',
      });
    }
    return (response as DisplaySidecarSessionListResponse).items.map(
      (session) => this.toAdminDisplaySession(session),
    );
  }

  async revokeDisplaySessions(ownerUserIds: readonly string[]) {
    const response = await this.request<
      Partial<DisplaySidecarApiSchemas['DisplaySessionRevocationDto']>
    >('/sessions/revoke', {
      method: 'POST',
      body: JSON.stringify({ ownerUserIds }),
    });
    const released = response?.released;
    if (
      typeof released !== 'number' ||
      !Number.isSafeInteger(released) ||
      released < 0
    ) {
      throw new BadGatewayException({
        code: 'display_sidecar_invalid_response',
        message:
          'Display sidecar returned an invalid revocation acknowledgement.',
      });
    }
    return { released };
  }

  async releaseDisplaySession(id: string) {
    const session = await this.request<unknown>(
      `/sessions/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    if (!this.isDisplaySession(session)) {
      throw new ConflictException({
        statusCode: 409,
        code: 'display_sidecar_invalid_response',
        message: 'Display sidecar returned a malformed session.',
      });
    }
    return this.toAdminDisplaySession(session);
  }

  async waitForReady(timeoutMs = 10_000, options?: DockerOperationOptions) {
    const deadline = new OperationDeadline(
      Math.min(timeoutMs, options?.deadline?.remainingMs() ?? timeoutMs),
    );
    const readiness = { deadline, signal: options?.signal };
    let lastError = 'Display sidecar API did not respond.';

    while (deadline.remainingMs() > 0) {
      options?.signal?.throwIfAborted();
      const error = await this.probeHealth(readiness);
      options?.signal?.throwIfAborted();
      options?.deadline?.throwIfExpired();
      if (!error) {
        try {
          await this.synchronizeFeatures(readiness);
          return;
        } catch (syncError) {
          options?.signal?.throwIfAborted();
          options?.deadline?.throwIfExpired();
          lastError = this.engine.errorMessage(syncError);
        }
      } else {
        lastError = error;
      }
      await delay(Math.min(250, deadline.remainingMs()), undefined, {
        signal: options?.signal,
      });
    }

    options?.signal?.throwIfAborted();
    options?.deadline?.throwIfExpired();
    throw new ConflictException(
      `Display sidecar API did not become ready: ${lastError}`,
    );
  }

  async synchronizeFeatures(options?: DockerOperationOptions) {
    const manifest = this.features.getManifest();
    const displayFeatures = manifest.features.filter(
      ({ owner }) => owner === 'display',
    );
    try {
      await this.request(
        '/features',
        {
          method: 'PUT',
          body: JSON.stringify({
            revision: manifest.revision,
            features: displayFeatures.map(({ key, enabled, supported }) => ({
              key,
              effective: enabled && supported,
            })),
          }),
        },
        options,
      );
      for (const { key } of displayFeatures) {
        this.features.markSynchronization(key, manifest.revision, 'applied');
      }
    } catch (error) {
      for (const { key } of displayFeatures) {
        this.features.markSynchronization(key, manifest.revision, 'failed');
      }
      throw error;
    }
  }

  async probeHealth(options?: DockerOperationOptions) {
    try {
      const response = await fetch(`${this.baseUrl()}/rebroid/display/health`, {
        signal: this.requestSignal(2_000, options),
      });
      void response.body?.cancel().catch(() => undefined);
      return response.ok
        ? null
        : `Display sidecar API returned ${response.status}.`;
    } catch (error) {
      return describeHealthProbeFailure(error);
    }
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    options?: DockerOperationOptions,
  ): Promise<T> {
    const secret = this.config.get<string>('app.sharedSecret');
    const response = await fetch(`${this.baseUrl()}/rebroid/display${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(secret ? { 'x-rebroid-sidecar-secret': secret } : {}),
        ...(init.headers ?? {}),
      },
      signal: this.requestSignal(10_000, options),
    }).catch((error) => {
      throw new ConflictException(
        `Display sidecar API is not reachable: ${this.engine.errorMessage(error)}`,
      );
    });

    if (!response.ok) {
      throw new ConflictException(
        `Display sidecar API returned ${response.status}.`,
      );
    }

    return response.json() as Promise<T>;
  }

  private requestSignal(timeoutMs: number, options?: DockerOperationOptions) {
    options?.signal?.throwIfAborted();
    options?.deadline?.throwIfExpired();
    const timeout = AbortSignal.timeout(
      Math.min(timeoutMs, options?.deadline?.remainingMs() ?? timeoutMs),
    );
    return options?.signal
      ? AbortSignal.any([timeout, options.signal])
      : timeout;
  }

  private baseUrl() {
    return this.config
      .getOrThrow<string>('app.displaySidecar.internalBaseUrl')
      .replace(/\/$/, '');
  }

  private toAdminDisplaySession(session: DisplaySidecarSession) {
    return {
      id: session.id,
      applicationId: session.appId ?? null,
      ownerUserId: session.ownerUserId ?? null,
      status: session.status,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      capabilities: session.capabilities,
    };
  }

  private isDisplaySession(value: unknown): value is DisplaySidecarSession {
    if (!value || typeof value !== 'object') return false;
    const session = value as Partial<DisplaySidecarSession>;
    return (
      typeof session.id === 'string' &&
      (session.appId === undefined || typeof session.appId === 'string') &&
      (session.ownerUserId === undefined ||
        typeof session.ownerUserId === 'string') &&
      (session.status === 'created' ||
        session.status === 'active' ||
        session.status === 'released' ||
        session.status === 'expired') &&
      typeof session.createdAt === 'string' &&
      typeof session.lastActivityAt === 'string' &&
      typeof session.expiresAt === 'string' &&
      Array.isArray(session.capabilities) &&
      session.capabilities.every((item) => typeof item === 'string')
    );
  }
}
