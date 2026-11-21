import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import {
  registerCron,
  unregisterCron,
  type CronTick,
} from '../../common/cron-registration';
import {
  AutomationTrigger,
  AutomationTriggerType,
} from '../entities/automation-trigger.entity';

const automationTriggerJobName = (id: string) => `automation-trigger:${id}`;

@Injectable()
export class AutomationCronRegistryService {
  constructor(private readonly scheduler: SchedulerRegistry) {}

  registerTrigger(
    trigger: AutomationTrigger,
    cronExpression: string | null,
    onTick: (tick: CronTick) => void,
  ) {
    registerCron(
      this.scheduler,
      automationTriggerJobName(trigger.id),
      trigger.enabled && trigger.triggerType === AutomationTriggerType.Schedule
        ? cronExpression
        : null,
      onTick,
    );
  }

  unregisterTrigger(id: string) {
    unregisterCron(this.scheduler, automationTriggerJobName(id));
  }
}
