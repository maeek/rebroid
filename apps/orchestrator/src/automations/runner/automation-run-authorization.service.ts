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
    ).catch((error: unknown) => {
      abortSignal?.throwIfAborted();
      const timedOut = timeout.aborted;
      const code = timedOut
        ? 'authorization_timeout'
        : 'authorization_unreachable';
      const cause = error instanceof Error ? error.cause : undefined;
      const transportCode =
        cause &&
        typeof cause === 'object' &&
        'code' in cause &&
        typeof cause.code === 'string' &&
        /^[A-Z0-9_]{1,64}$/.test(cause.code)
          ? cause.code
          : undefined;
      this.logger.warn({ requestId, code, transportCode });
      throw new AutomationAuthorizationError(
        timedOut
          ? 'Workflow authorization timed out.'
          : 'The web service could not be reached to authorize this workflow.',
        requestId,
        code,
      );
    });
    if (!response.ok) {
      const { code, message } = authorizationResponseFailure(response.status);
      this.logger.warn({ requestId, code, httpStatus: response.status });
      throw new AutomationAuthorizationError(
        message,
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

const authorizationResponseFailure = (status: number) => {
  if (status === 401)
    return {
      code: 'authorization_credentials',
      message: 'The web service rejected the orchestrator credentials.',
    };
  if (status === 403)
    return {
      code: 'authorization_rejected',
      message: 'Workflow authorization was rejected.',
    };
  if (status === 400)
    return {
      code: 'authorization_invalid_request',
      message: 'The web service rejected the authorization request format.',
    };
  return {
    code: 'authorization_unavailable',
    message: 'The web service could not authorize this workflow.',
  };
};
