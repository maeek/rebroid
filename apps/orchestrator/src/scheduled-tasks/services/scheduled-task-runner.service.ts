import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
import {
  ScheduledTask,
  ScheduledTaskLastStatus,
} from '../entities/scheduled-task.entity';
import { ScheduledTasksRepository } from '../persistence/scheduled-tasks.repository';
import { ScheduledTaskActionsService } from './scheduled-task-actions.service';
import { ScheduledTaskCronRegistryService } from './scheduled-task-cron-registry.service';
import { ScheduledTaskScheduleService } from './scheduled-task-schedule.service';

@Injectable()
export class ScheduledTaskRunnerService {
  private readonly logger = new Logger(ScheduledTaskRunnerService.name);
  private readonly runningTasks = new Set<string>();

  constructor(
    private readonly tasks: ScheduledTasksRepository,
    private readonly actions: ScheduledTaskActionsService,
    private readonly registry: ScheduledTaskCronRegistryService,
    private readonly schedule: ScheduledTaskScheduleService,
  ) {}

  async runTask(id: string) {
    if (this.runningTasks.has(id)) {
      return;
    }

    const task = await this.tasks.findById(id);
    if (!task) {
      this.registry.unregisterTask(id);
      return;
    }

    this.runningTasks.add(id);
    try {
      await this.actions.run(task.actionType, this.parsePayload(task));
      task.lastStatus = ScheduledTaskLastStatus.Success;
      task.lastError = null;
    } catch (error) {
      task.lastStatus = ScheduledTaskLastStatus.Failed;
      task.lastError = getErrorMessage(error);
      this.logger.warn(
        `Scheduled task "${task.name}" failed: ${task.lastError}`,
      );
    } finally {
      task.lastRunAt = new Date();
      task.nextRunAt = task.enabled
        ? this.schedule.nextRun(task.cronExpression)
        : null;
      await this.tasks.save(task);
      this.runningTasks.delete(id);
    }
  }

  parsePayload(task: Pick<ScheduledTask, 'payloadJson'>) {
    if (!task.payloadJson) {
      return null;
    }
    return JSON.parse(task.payloadJson) as Record<string, unknown>;
  }
}
