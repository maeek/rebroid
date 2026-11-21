import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ScheduledTask } from '../entities/scheduled-task.entity';

const taskJobName = (id: string) => `scheduled-task:${id}`;

export type ScheduledTaskTick = {
  cronExpression: string;
  isCurrent: () => boolean;
};

@Injectable()
export class ScheduledTaskCronRegistryService {
  constructor(private readonly scheduler: SchedulerRegistry) {}

  registerTask(task: ScheduledTask, onTick: (tick: ScheduledTaskTick) => void) {
    const name = taskJobName(task.id);
    if (!task.enabled) {
      this.unregisterTask(task.id);
      return;
    }

    const current = this.scheduler.getCronJobs().get(name);
    if (current?.isActive && current.cronTime.source === task.cronExpression) {
      return;
    }

    const tick: ScheduledTaskTick = {
      cronExpression: task.cronExpression,
      isCurrent: () => this.scheduler.getCronJobs().get(name) === job,
    };
    const job = CronJob.from({
      cronTime: task.cronExpression,
      onTick: () => onTick(tick),
      start: false,
    });
    this.unregisterTask(task.id);
    this.scheduler.addCronJob(name, job);
    job.start();
  }

  unregisterTask(id: string) {
    const name = taskJobName(id);
    try {
      this.scheduler.deleteCronJob(name);
    } catch {
      return;
    }
  }
}
