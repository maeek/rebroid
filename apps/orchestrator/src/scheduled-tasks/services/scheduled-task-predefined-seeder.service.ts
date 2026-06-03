import { Injectable } from '@nestjs/common';
import {
  ScheduledTaskActionType,
  ScheduledTaskKind,
  ScheduledTaskLastStatus,
} from '../entities/scheduled-task.entity';
import { ScheduledTasksRepository } from '../persistence/scheduled-tasks.repository';
import { ScheduledTaskActionsService } from './scheduled-task-actions.service';
import { ScheduledTaskScheduleService } from './scheduled-task-schedule.service';

type PredefinedScheduledTask = {
  key: string;
  name: string;
  enabled: boolean;
  cronExpression: string;
  actionType: ScheduledTaskActionType;
  payload: Record<string, unknown> | null;
};

const predefinedTasks: PredefinedScheduledTask[] = [
  {
    key: 'clean-uploaded-apks',
    name: 'Clean APK uploads',
    enabled: true,
    cronExpression: '0 2 * * *',
    actionType: ScheduledTaskActionType.CleanUploadedApks,
    payload: null,
  },
  {
    key: 'prune-docker-images',
    name: 'Prune Docker images',
    enabled: true,
    cronExpression: '0 3 * * *',
    actionType: ScheduledTaskActionType.PruneImages,
    payload: { danglingOnly: true },
  },
  {
    key: 'clean-runtime-logs',
    name: 'Clean runtime logs',
    enabled: true,
    cronExpression: '0 4 * * 0',
    actionType: ScheduledTaskActionType.CleanRuntimeLogs,
    payload: { retentionDays: 30 },
  },
  {
    key: 'prune-stopped-containers',
    name: 'Prune stopped containers',
    enabled: false,
    cronExpression: '0 4 * * 6',
    actionType: ScheduledTaskActionType.PruneContainers,
    payload: null,
  },
  {
    key: 'prune-unused-networks',
    name: 'Prune unused networks',
    enabled: false,
    cronExpression: '30 4 * * 6',
    actionType: ScheduledTaskActionType.PruneNetworks,
    payload: null,
  },
  {
    key: 'prune-unused-volumes',
    name: 'Prune unused volumes',
    enabled: false,
    cronExpression: '0 5 1 * *',
    actionType: ScheduledTaskActionType.PruneVolumes,
    payload: null,
  },
  {
    key: 'full-docker-cleanup',
    name: 'Full Docker cleanup',
    enabled: false,
    cronExpression: '0 5 1 * *',
    actionType: ScheduledTaskActionType.PruneAll,
    payload: null,
  },
];

@Injectable()
export class ScheduledTaskPredefinedSeederService {
  constructor(
    private readonly tasks: ScheduledTasksRepository,
    private readonly actions: ScheduledTaskActionsService,
    private readonly schedule: ScheduledTaskScheduleService,
  ) {}

  async ensurePredefinedTasks() {
    const existingTasks = await this.tasks.findByPredefinedKeys(
      predefinedTasks.map((task) => task.key),
    );
    const existingKeys = new Set(
      existingTasks.map((task) => task.predefinedKey),
    );

    for (const predefined of predefinedTasks) {
      if (existingKeys.has(predefined.key)) {
        continue;
      }

      const cronExpression = this.schedule.validateCronExpression(
        predefined.cronExpression,
      );
      const payload = this.actions.normalizePayload(
        predefined.actionType,
        predefined.payload,
      );
      await this.tasks.save(
        this.tasks.create({
          name: predefined.name,
          enabled: predefined.enabled,
          kind: ScheduledTaskKind.Predefined,
          predefinedKey: predefined.key,
          cronExpression,
          actionType: predefined.actionType,
          payloadJson: payload ? JSON.stringify(payload) : null,
          lastStatus: ScheduledTaskLastStatus.NeverRun,
          lastRunAt: null,
          lastError: null,
          nextRunAt: predefined.enabled
            ? this.schedule.nextRun(cronExpression)
            : null,
        }),
      );
    }
  }
}
