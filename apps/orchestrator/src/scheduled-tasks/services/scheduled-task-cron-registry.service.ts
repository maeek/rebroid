import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ScheduledTask } from '../entities/scheduled-task.entity';

const taskJobName = (id: string) => `scheduled-task:${id}`;

@Injectable()
export class ScheduledTaskCronRegistryService {
  constructor(private readonly scheduler: SchedulerRegistry) {}

  registerTask(task: ScheduledTask, onTick: () => void) {
    this.unregisterTask(task.id);
    if (!task.enabled) {
      return;
    }

    const job = CronJob.from({
      cronTime: task.cronExpression,
      onTick,
      start: false,
    });
    this.scheduler.addCronJob(taskJobName(task.id), job);
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
