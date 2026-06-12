import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AutomationDefinition } from '@rebroid/automation-core/definition';
import { AutomationLastStatus } from '../entities/automation.entity';
import { AutomationsRepository } from '../persistence/automations.repository';
import { RunnableAutomation } from './automation-runnable';

@Injectable()
export class EphemeralAutomationRegistryService {
  private readonly automations = new Map<string, RunnableAutomation>();

  constructor(private readonly repository: AutomationsRepository) {}

  create(ownerUserId: string, definition: AutomationDefinition) {
    const now = new Date();
    const automation = this.repository.create({
      id: `ephemeral-ai-${randomUUID()}`,
      ownerUserId: ownerUserId.trim(),
      name: definition.metadata.name,
      description: definition.metadata.description ?? null,
      definitionJson: JSON.stringify(definition),
      lastStatus: AutomationLastStatus.Running,
      lastRunAt: now,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
    const runnable = {
      definition,
      entity: automation,
      ephemeral: true,
    };
    this.automations.set(automation.id, runnable);
    return runnable;
  }

  get(automationId: string) {
    return this.automations.get(automationId);
  }

  delete(automationId: string) {
    this.automations.delete(automationId);
  }
}
