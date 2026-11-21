import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { nextCronRun } from '../../common/cron-schedule';
import { getErrorMessage } from '../../common/error-message';
import {
  ScheduledTask,
  ScheduledTaskLastStatus,
} from '../entities/scheduled-task.entity';
import { ScheduledTasksRepository } from '../persistence/scheduled-tasks.repository';
import { ScheduledTaskActionsService } from './scheduled-task-actions.service';
import {
  ScheduledTaskCronRegistryService,
  type ScheduledTaskTick,
} from './scheduled-task-cron-registry.service';

@Injectable()
export class ScheduledTaskRunnerService {
  private readonly logger = new Logger(ScheduledTaskRunnerService.name);
  private readonly runningTasks = new Set<string>();

  constructor(
    private readonly tasks: ScheduledTasksRepository,
    private readonly actions: ScheduledTaskActionsService,
    private readonly registry: ScheduledTaskCronRegistryService,
  ) {}

  async runTask(id: string, tick?: ScheduledTaskTick) {
    if (this.runningTasks.has(id)) {
      if (!tick)
        throw new ConflictException(
          'This maintenance task is already running.',
        );
      return;
    }

    if (tick && !tick.isCurrent()) return;
    this.runningTasks.add(id);
    try {
      const task = await this.tasks.findById(id);
      if (!task) {
        this.registry.unregisterTask(id);
        if (!tick)
          throw new NotFoundException(`Scheduled task "${id}" was not found.`);
        return;
      }
      if (
        tick &&
        (!tick.isCurrent() ||
          !task.enabled ||
          task.cronExpression !== tick.cronExpression)
      ) {
        return;
      }

      let lastStatus = ScheduledTaskLastStatus.Success;
      let lastError: string | null = null;
      try {
        await this.actions.run(task.actionType, this.parsePayload(task));
      } catch (error) {
        lastStatus = ScheduledTaskLastStatus.Failed;
        lastError = getErrorMessage(error);
        this.logger.warn(`Scheduled task "${task.name}" failed: ${lastError}`);
      }
      await this.tasks.recordRunResult(id, {
        lastStatus,
        lastError,
        lastRunAt: new Date(),
      });
      const current = await this.tasks.findById(id);
      if (current) {
        await this.tasks.updateNextRun(
          current,
          current.enabled ? nextCronRun(current.cronExpression) : null,
        );
      }
    } finally {
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
