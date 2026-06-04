import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Automation } from '../entities/automation.entity';

const automationJobName = (id: string) => `automation:${id}`;

@Injectable()
export class AutomationCronRegistryService {
  constructor(private readonly scheduler: SchedulerRegistry) {}

  registerAutomation(automation: Automation, onTick: () => void) {
    this.unregisterAutomation(automation.id);
    if (!automation.scheduleEnabled || !automation.cronExpression) {
      return;
    }

    const job = CronJob.from({
      cronTime: automation.cronExpression,
      onTick,
      start: false,
    });
    this.scheduler.addCronJob(automationJobName(automation.id), job);
    job.start();
  }

  unregisterAutomation(id: string) {
    try {
      this.scheduler.deleteCronJob(automationJobName(id));
    } catch {
      return;
    }
  }
}
