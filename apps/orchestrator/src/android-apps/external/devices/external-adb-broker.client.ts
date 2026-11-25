import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { FeatureFlagsService } from '../../../feature-flags/feature-flags.service';
import {
  externalAdbTcpCheckStatuses,
  externalDeviceFailures,
  externalDeviceStates,
  type ExternalAutomationOperation,
} from '@rebroid/android-application-core/android-device';
import { z } from 'zod';

const connection = z.object({
  state: z.enum(externalDeviceStates),
  failure: z.enum(externalDeviceFailures).nullable(),
  attemptId: z.uuid().nullable(),
  attachmentId: z.uuid().nullable(),
  observedAt: z.iso.datetime().nullable(),
});
const candidates = z
  .array(
    z.object({
      candidateId: z.uuid(),
      label: z.string().max(120),
      state: z.string().max(48),
    }),
  )
  .max(64);
const instructions = z.object({
  androidPromptObserved: z.boolean(),
  challenge: z
    .string()
    .regex(/^[a-f0-9]{32}$/)
    .nullable(),
  fingerprint: z
    .string()
    .regex(/^(?:[A-F0-9]{2}:){15}[A-F0-9]{2}$/)
    .nullable(),
});
const viewer = z.object({
  session: z.object({
    id: z.uuid(),
    viewerPath: z.string().startsWith('/external-display/viewer/display?'),
    capabilities: z.array(z.string()),
  }),
});
const adminSession = z.object({
  id: z.uuid(),
  appId: z.uuid().optional(),
  ownerUserId: z.string().optional(),
  runtimeId: z.uuid().optional(),
  status: z.enum(['created', 'active', 'released', 'expired']),
  createdAt: z.iso.datetime(),
  lastActivityAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  capabilities: z.array(z.string()),
});

@Injectable()
export class ExternalAdbBrokerClient {
  constructor(
    private readonly config: ConfigService,
    private readonly features: FeatureFlagsService,
  ) {}

  get enabled() {
    return Boolean(
      this.config.get<string>('app.externalAdb.brokerUrl') &&
      this.config.get<string>('app.externalAdb.brokerSecret'),
    );
  }

  checkReadiness(signal: AbortSignal) {
    return this.request(
      '/health/ready',
      z.object({
        ok: z.literal(true),
        externalAdb: z.object({
          adb: z.literal(true),
          keyStorage: z.literal(true),
        }),
      }),
      'GET',
      undefined,
      '',
      signal,
    );
  }

  async listCandidates() {
    return this.request('/candidates', candidates);
  }

  async resolveCandidate(candidateId: string) {
    return this.request(
      `/candidates/${encodeURIComponent(candidateId)}`,
      z.object({
        selector: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    );
  }

  checkTcpEndpoint(endpoint: string, signal: AbortSignal) {
    return this.request(
      '/tcp-check',
      z.object({ status: z.enum(externalAdbTcpCheckStatuses) }),
      'POST',
      { endpoint },
      undefined,
      signal,
    );
  }

  connect(
    id: string,
    attemptId: string,
    input: { transport: 'usb' | 'tcp'; selector: string },
  ) {
    return this.request(
      this.attemptPath(id, attemptId),
      connection,
      'POST',
      input,
    );
  }

  inspect(id: string, attemptId: string, signal?: AbortSignal) {
    return this.request(
      this.attemptPath(id, attemptId),
      connection,
      'GET',
      undefined,
      undefined,
      signal,
    );
  }

  instructions(id: string, attemptId: string) {
    return this.request(
      `${this.attemptPath(id, attemptId)}/instructions`,
      instructions,
    );
  }

  verify(id: string, attemptId: string, proof: string) {
    return this.request(
      `${this.attemptPath(id, attemptId)}/verify`,
      connection,
      'POST',
      { proof },
    );
  }

  detach(id: string, attemptId: string) {
    return this.request(
      this.attemptPath(id, attemptId),
      z.object({ detached: z.literal(true) }),
      'DELETE',
    );
  }

  createViewer(
    id: string,
    ownerUserId: string,
    attachmentId: string,
    capabilities: string[],
  ) {
    return this.request(
      '/sessions',
      viewer,
      'POST',
      {
        appId: id,
        ownerUserId,
        udid: attachmentId,
        runtimeId: attachmentId,
        capabilities,
      },
      '/rebroid/display',
    );
  }

  screenshot(id: string, attachmentId: string, signal?: AbortSignal) {
    return this.request(
      `/devices/${id}/attachments/${attachmentId}/screenshot`,
      z.object({
        pngBase64: z
          .string()
          .min(12)
          .max(16 * 1024 * 1024),
      }),
      'GET',
      undefined,
      undefined,
      signal,
    );
  }

  automate<T>(
    id: string,
    attachmentId: string,
    input: ExternalAutomationOperation,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
  ) {
    return this.request(
      `/devices/${id}/attachments/${attachmentId}/automation`,
      schema,
      'POST',
      input,
      undefined,
      signal,
    );
  }

  logcat(id: string, attachmentId: string) {
    return this.request(
      `/devices/${id}/attachments/${attachmentId}/logcat`,
      z.object({
        collectedAt: z.iso.datetime(),
        output: z.string().max(256 * 1024),
      }),
    );
  }

  @Cron('*/10 * * * * *', {
    name: 'external-display-features',
    waitForCompletion: true,
  })
  async refreshFeatureSnapshot() {
    if (!this.enabled) return;
    await this.synchronizeViewerFeatures().catch(() => undefined);
  }

  synchronizeViewerFeatures(signal?: AbortSignal) {
    const { revision, features } = this.features.getManifest();
    const webrtc = features.some(
      (feature) =>
        feature.key === 'feature.display-webrtc' &&
        feature.enabled &&
        feature.supported,
    );
    return this.request(
      '/features',
      z.object({ revision: z.number() }),
      'PUT',
      {
        revision,
        features: [
          { key: 'feature.display-virtual', effective: false },
          { key: 'feature.display-webrtc', effective: webrtc },
          {
            key: 'feature.external-devices',
            effective: this.features.isEnabled('feature.external-devices'),
          },
        ],
      },
      '/rebroid/display',
      signal,
    );
  }

  listViewers() {
    return this.request(
      '/sessions/inventory',
      z.object({ items: z.array(adminSession).max(256) }),
      'GET',
      undefined,
      '/rebroid/display',
    );
  }

  async releaseViewer(id: string) {
    return this.request(
      `/sessions/${id}`,
      adminSession,
      'DELETE',
      undefined,
      '/rebroid/display',
    );
  }

  revokeViewers(ownerUserIds: string[]) {
    return this.request(
      '/sessions/revoke',
      z.object({ released: z.number().int().nonnegative() }),
      'POST',
      { ownerUserIds },
      '/rebroid/display',
    );
  }

  private attemptPath(id: string, attemptId: string) {
    return `/devices/${encodeURIComponent(id)}/attempts/${encodeURIComponent(attemptId)}`;
  }

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    method = 'GET',
    body?: unknown,
    prefix = '/rebroid/external-adb',
    signal?: AbortSignal,
  ): Promise<T> {
    const base = this.config.get<string>('app.externalAdb.brokerUrl');
    const secret = this.config.get<string>('app.externalAdb.brokerSecret');
    if (!base || !secret) throw this.unavailable();
    signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(8_000);
    const request = {
      method,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    };
    let response: Response;
    try {
      response = await fetch(`${base.replace(/\/$/, '')}${prefix}${path}`, {
        ...request,
        headers: {
          'x-rebroid-sidecar-secret': secret,
          ...(body !== undefined && { 'content-type': 'application/json' }),
        },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        redirect: 'error',
      });
      if (response.ok) return schema.parse(await response.json());
      await response.body?.cancel();
    } catch {
      signal?.throwIfAborted();
      throw this.unavailable();
    }
    if (response.status === 409)
      throw new ConflictException({
        code: 'external_adb_attempt_conflict',
        message:
          'Check the current device connection and verification details.',
      });
    if (response.status === 404)
      throw new NotFoundException('External display session is unavailable.');
    throw this.unavailable();
  }

  private unavailable() {
    return new ServiceUnavailableException({
      code: 'external_adb_broker_unavailable',
      message: 'External ADB is unavailable.',
    });
  }
}
