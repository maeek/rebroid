import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
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
    onTick: () => void,
  ) {
    this.unregisterTrigger(trigger.id);
    if (
      !trigger.enabled ||
      trigger.triggerType !== AutomationTriggerType.Schedule ||
      !cronExpression
    ) {
      return;
    }

    const job = CronJob.from({
      cronTime: cronExpression,
      onTick,
      start: false,
    });
    this.scheduler.addCronJob(automationTriggerJobName(trigger.id), job);
    job.start();
  }

  unregisterTrigger(id: string) {
    try {
      this.scheduler.deleteCronJob(automationTriggerJobName(id));
    } catch {
      return;
    }
  }
}
