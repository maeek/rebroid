import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import {
  registerCron,
  unregisterCron,
  type CronTick,
} from '../../common/cron-registration';
import { ScheduledTask } from '../entities/scheduled-task.entity';

const taskJobName = (id: string) => `scheduled-task:${id}`;

export type ScheduledTaskTick = CronTick;

@Injectable()
export class ScheduledTaskCronRegistryService {
  constructor(private readonly scheduler: SchedulerRegistry) {}

  registerTask(task: ScheduledTask, onTick: (tick: ScheduledTaskTick) => void) {
    registerCron(
      this.scheduler,
      taskJobName(task.id),
      task.enabled ? task.cronExpression : null,
      onTick,
    );
  }

  unregisterTask(id: string) {
    unregisterCron(this.scheduler, taskJobName(id));
  }
}
