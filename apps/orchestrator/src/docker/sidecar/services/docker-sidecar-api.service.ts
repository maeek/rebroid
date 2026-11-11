import {
  ConflictException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DisplaySidecarApiSchemas } from '@rebroid/display-sidecar-contracts';
import { setTimeout as delay } from 'node:timers/promises';
import { DockerEngineService } from '../../docker-engine.service';
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

type DisplaySidecarSession = DisplaySidecarApiSchemas['DisplaySessionDto'];
type DisplaySidecarSessionListResponse =
  DisplaySidecarApiSchemas['DisplaySessionListResponseDto'];

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
    const response = await this.request<unknown>('/sessions');
    if (
      !response ||
      typeof response !== 'object' ||
      !Array.isArray((response as DisplaySidecarSessionListResponse).items) ||
      !(response as DisplaySidecarSessionListResponse).items.every((session) =>
        this.isDisplaySession(session),
      )
    ) {
      throw new ConflictException({
        statusCode: 409,
        code: 'display_sidecar_invalid_response',
        message: 'Display sidecar returned a malformed session list.',
      });
    }
    return (response as DisplaySidecarSessionListResponse).items.map(
      (session) => this.toAdminDisplaySession(session),
    );
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

  async waitForReady(timeoutMs = 10_000) {
    const deadline = Date.now() + timeoutMs;
    let lastError = 'Display sidecar API did not respond.';

    while (Date.now() < deadline) {
      const error = await this.probeHealth();
      if (!error) {
        try {
          await this.synchronizeFeatures();
          return;
        } catch (syncError) {
          lastError = this.engine.errorMessage(syncError);
        }
      } else {
        lastError = error;
      }
      await delay(250);
    }

    throw new ConflictException(
      `Display sidecar API did not become ready: ${lastError}`,
    );
  }

  async synchronizeFeatures() {
    const manifest = this.features.getManifest();
    const displayFeatures = manifest.features.filter(
      ({ owner }) => owner === 'display',
    );
    try {
      await this.request('/features', {
        method: 'PUT',
        body: JSON.stringify({
          revision: manifest.revision,
          features: displayFeatures.map(({ key, enabled, supported }) => ({
            key,
            effective: enabled && supported,
          })),
        }),
      });
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

  async probeHealth() {
    try {
      const response = await fetch(`${this.baseUrl()}/rebroid/display/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      void response.body?.cancel().catch(() => undefined);
      return response.ok
        ? null
        : `Display sidecar API returned ${response.status}.`;
    } catch (error) {
      return describeHealthProbeFailure(error);
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const secret = this.config.get<string>('app.sharedSecret');
    const response = await fetch(`${this.baseUrl()}/rebroid/display${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(secret ? { 'x-rebroid-sidecar-secret': secret } : {}),
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(10_000),
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
      typeof session.udid === 'string' &&
      typeof session.status === 'string' &&
      typeof session.createdAt === 'string' &&
      typeof session.lastActivityAt === 'string' &&
      typeof session.expiresAt === 'string' &&
      Array.isArray(session.capabilities)
    );
  }
}
