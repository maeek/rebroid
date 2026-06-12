import { Injectable } from '@nestjs/common';
import {
  Automation,
  AutomationLastStatus,
} from '../entities/automation.entity';
import {
  AutomationRun,
  AutomationRunStatus,
} from '../entities/automation-run.entity';
import { AutomationTriggersRepository } from '../persistence/automation-triggers.repository';
import { AutomationsRepository } from '../persistence/automations.repository';

@Injectable()
export class AutomationRunFinalizerService {
  constructor(
    private readonly automations: AutomationsRepository,
    private readonly triggers: AutomationTriggersRepository,
  ) {}

  async updatePersistedAutomationAfterRun(
    automation: Automation,
    run: AutomationRun,
    failed: boolean,
  ) {
    automation.lastStatus =
      run.status === AutomationRunStatus.Canceled || failed
        ? AutomationLastStatus.Failed
        : AutomationLastStatus.Success;
    automation.lastRunAt = run.completedAt;
    automation.lastError = failed ? run.error : null;
    const trigger = run.automationTriggerId
      ? await this.triggers.findByOwnerAndId(
          automation.ownerUserId,
          run.automationTriggerId,
        )
      : null;
    if (trigger) {
      trigger.lastStatus = automation.lastStatus;
      trigger.lastRunAt = run.completedAt;
      trigger.lastError = automation.lastError;
      await this.triggers.save(trigger);
    }
    await this.automations.save(automation);
  }
}
