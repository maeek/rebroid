import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setTimeout as delay } from 'node:timers/promises';
import { DockerEngineService } from '../../docker-engine.service';

interface DisplaySidecarSession {
  id: string;
  appId?: string;
  ownerUserId?: string;
  status: 'created' | 'active' | 'released' | 'expired';
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  capabilities: string[];
}

interface DisplaySidecarSessionListResponse {
  items: DisplaySidecarSession[];
}

@Injectable()
export class DockerSidecarApiService {
  constructor(
    private readonly config: ConfigService,
    private readonly engine: DockerEngineService,
  ) {}

  async listDisplaySessions() {
    const response =
      await this.request<DisplaySidecarSessionListResponse>('/sessions');
    return response.items.map((session) => this.toAdminDisplaySession(session));
  }

  async releaseDisplaySession(id: string) {
    const session = await this.request<DisplaySidecarSession>(
      `/sessions/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    return this.toAdminDisplaySession(session);
  }

  async waitForReady(timeoutMs = 10_000) {
    const deadline = Date.now() + timeoutMs;
    let lastError = 'Display sidecar API did not respond.';

    while (Date.now() < deadline) {
      const error = await this.probeHealth();
      if (!error) {
        return;
      }

      lastError = error;
      await delay(250);
    }

    throw new ConflictException(
      `Display sidecar API did not become ready: ${lastError}`,
    );
  }

  async probeHealth() {
    try {
      const response = await fetch(`${this.baseUrl()}/rebroid/display/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      return response.ok
        ? null
        : `Display sidecar API returned ${response.status}.`;
    } catch (error) {
      return this.engine.errorMessage(error);
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const secret = this.config.get<string>('app.sharedSecret');
    const response = await fetch(`${this.baseUrl()}/rebroid/display${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
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
}
