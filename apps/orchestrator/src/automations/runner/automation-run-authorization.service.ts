import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AutomationDefinition } from '@rebroid/automation-core/definition';
import type { AutomationRunTargetOptions } from './automation-runner-options';

@Injectable()
export class AutomationRunAuthorizationService {
  constructor(private readonly config: ConfigService) {}

  async assertAllowed(
    ownerUserId: string,
    definition: AutomationDefinition,
    targetApplicationId: string,
    options: AutomationRunTargetOptions,
  ) {
    const base = this.config.getOrThrow<string>('app.webInternalUrl');
    const secret = this.config.getOrThrow<string>('app.sharedSecret');
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
          profileMode: options.targetProfileMode,
          profileName: options.targetProfileName,
          startPolicy: options.startPolicy,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok)
      throw new ForbiddenException('Automation authorization failed.');
  }
}
