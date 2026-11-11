import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { AutomationDefinition } from '@rebroid/automation-core/definition';

export class AutomationAuthorizationError extends Error {
  constructor(
    message: string,
    readonly requestId: string,
    readonly code: string,
    readonly httpStatus?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AutomationRunAuthorizationService {
  private readonly logger = new Logger(AutomationRunAuthorizationService.name);
  constructor(private readonly config: ConfigService) {}

  async assertAllowed(
    ownerUserId: string,
    definition: AutomationDefinition,
    targetApplicationId: string,
    target: {
      operation: 'attach' | 'start';
      profileMode?: string | null;
      profileName?: string | null;
    },
    abortSignal?: AbortSignal,
  ) {
    const base = this.config.getOrThrow<string>('app.webInternalUrl');
    const secret = this.config.getOrThrow<string>('app.sharedSecret');
    const timeout = AbortSignal.timeout(10_000);
    const requestId = randomUUID();
    const response = await fetch(
      new URL('/api/internal/automations/authorize', base),
      {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          'x-orchestrator-secret': secret,
          'x-request-id': requestId,
        },
        body: JSON.stringify({
          ownerUserId,
          definition,
          targetApplicationId,
          ...target,
        }),
        signal: abortSignal ? AbortSignal.any([abortSignal, timeout]) : timeout,
      },
    ).catch(() => {
      abortSignal?.throwIfAborted();
      const timedOut = timeout.aborted;
      const code = timedOut
        ? 'authorization_timeout'
        : 'authorization_unreachable';
      this.logger.warn({ requestId, code });
      throw new AutomationAuthorizationError(
        timedOut
          ? 'Workflow authorization timed out.'
          : 'The web service could not be reached to authorize this workflow.',
        requestId,
        code,
      );
    });
    if (!response.ok) {
      const code =
        response.status >= 500
          ? 'authorization_unavailable'
          : 'authorization_rejected';
      this.logger.warn({ requestId, code, httpStatus: response.status });
      throw new AutomationAuthorizationError(
        response.status >= 500
          ? 'The web service could not authorize this workflow.'
          : 'Workflow authorization was rejected.',
        requestId,
        code,
        response.status,
      );
    }
    if (target.operation !== 'start') return undefined;
    const quota = response.headers.get('x-rebroid-max-open-apps');
    if (quota === 'unlimited') return undefined;
    if (
      quota === null ||
      !/^\d+$/.test(quota) ||
      !Number.isSafeInteger(Number(quota))
    ) {
      const code = 'authorization_invalid_quota';
      this.logger.warn({ requestId, code });
      throw new AutomationAuthorizationError(
        'Workflow authorization did not provide a valid open application limit.',
        requestId,
        code,
      );
    }
    return Number(quota);
  }
}
