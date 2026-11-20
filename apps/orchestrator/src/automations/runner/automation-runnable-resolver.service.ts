import { Injectable } from '@nestjs/common';
import { AutomationDefinition } from '@rebroid/automation-core/definition';
import { AutomationsRepository } from '../persistence/automations.repository';
import { RunnableAutomation } from './automation-runnable';
import { EphemeralAutomationRegistryService } from './ephemeral-automation-registry.service';

@Injectable()
export class AutomationRunnableResolverService {
  constructor(
    private readonly automations: AutomationsRepository,
    private readonly ephemeralAutomations: EphemeralAutomationRegistryService,
  ) {}

  async resolve(automationId: string): Promise<RunnableAutomation | null> {
    if (!automationId) return null;
    const ephemeral = this.ephemeralAutomations.get(automationId);
    if (ephemeral) {
      return ephemeral;
    }

    const automation = await this.automations.findById(automationId);
    if (!automation) {
      return null;
    }
    return {
      definition: JSON.parse(automation.definitionJson) as AutomationDefinition,
      entity: automation,
      ephemeral: false,
    };
  }
}
