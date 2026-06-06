import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AutomationStartPolicy,
  AutomationTrigger,
  AutomationTriggerType,
} from '../entities/automation-trigger.entity';
import { AutomationCronRegistryService } from '../scheduler/automation-cron-registry.service';
import { AutomationScheduleService } from '../scheduler/automation-schedule.service';

export interface ScheduleTriggerConfig {
  cronExpression: string;
  startPolicy: AutomationStartPolicy;
}

@Injectable()
export class AutomationTriggerSchedulerService {
  constructor(
    private readonly cronRegistry: AutomationCronRegistryService,
    private readonly schedule: AutomationScheduleService,
  ) {}

  normalizeConfig(
    triggerType: AutomationTriggerType,
    config: Record<string, unknown>,
  ) {
    if (triggerType !== AutomationTriggerType.Schedule) {
      throw new BadRequestException(
        `Automation trigger type "${triggerType}" is not supported yet.`,
      );
    }
    const cronExpressionValue = config.cronExpression;
    if (typeof cronExpressionValue !== 'string') {
      throw new BadRequestException(
        'triggerConfig.cronExpression is required for schedule triggers.',
      );
    }
    const startPolicy =
      config.startPolicy === AutomationStartPolicy.RequireRunning
        ? AutomationStartPolicy.RequireRunning
        : AutomationStartPolicy.StartIfNeeded;

    return {
      cronExpression: this.schedule.validateCronExpression(cronExpressionValue),
      startPolicy,
    } satisfies ScheduleTriggerConfig;
  }

  nextRunForTrigger(
    triggerType: AutomationTriggerType,
    config: Record<string, unknown>,
  ) {
    if (triggerType !== AutomationTriggerType.Schedule) {
      return null;
    }
    return this.schedule.nextRun(
      (config as unknown as ScheduleTriggerConfig).cronExpression,
    );
  }

  parseScheduleConfig(trigger: AutomationTrigger) {
    return this.normalizeConfig(
      AutomationTriggerType.Schedule,
      JSON.parse(trigger.triggerConfigJson) as Record<string, unknown>,
    );
  }

  register(trigger: AutomationTrigger, onRun: () => void) {
    const cronExpression =
      trigger.triggerType === AutomationTriggerType.Schedule
        ? this.parseScheduleConfig(trigger).cronExpression
        : null;
    this.cronRegistry.registerTrigger(trigger, cronExpression, onRun);
  }

  unregister(triggerId: string) {
    this.cronRegistry.unregisterTrigger(triggerId);
  }
}
