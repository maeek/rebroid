import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AutomationDefinition } from '@rebroid/automation-core/definition';

@Injectable()
export class AutomationRunAuthorizationService {
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
    const response = await fetch(
      new URL('/api/internal/automations/authorize', base),
      {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          'x-orchestrator-secret': secret,
        },
        body: JSON.stringify({
          ownerUserId,
          definition,
          targetApplicationId,
          ...target,
        }),
        signal: abortSignal ? AbortSignal.any([abortSignal, timeout]) : timeout,
      },
    );
    if (!response.ok)
      throw new ForbiddenException('Automation authorization failed.');
    if (target.operation !== 'start') return undefined;
    const quota = response.headers.get('x-rebroid-max-open-apps');
    if (quota === 'unlimited') return undefined;
    if (
      quota === null ||
      !/^\d+$/.test(quota) ||
      !Number.isSafeInteger(Number(quota))
    ) {
      throw new ForbiddenException(
        'Automation authorization did not provide a valid open application limit.',
      );
    }
    return Number(quota);
  }
}
