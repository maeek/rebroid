import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { CronJob, sendAt, validateCronExpression } from 'cron';
import { In, Repository } from 'typeorm';
import { getErrorMessage } from '../../common/error-message';
import {
  CreateScheduledTaskDto,
  ScheduledTaskDto,
  UpdateScheduledTaskDto,
} from '../dto/scheduled-task.dto';
import {
  ScheduledTask,
  ScheduledTaskActionType,
  ScheduledTaskKind,
  ScheduledTaskLastStatus,
} from '../entities/scheduled-task.entity';
import { ScheduledTaskActionsService } from './scheduled-task-actions.service';

const taskJobName = (id: string) => `scheduled-task:${id}`;

const toIso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;

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
export class ScheduledTasksService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledTasksService.name);
  private readonly runningTasks = new Set<string>();

  constructor(
    @InjectRepository(ScheduledTask)
    private readonly tasks: Repository<ScheduledTask>,
    private readonly scheduler: SchedulerRegistry,
    private readonly actions: ScheduledTaskActionsService,
  ) {}

  async onModuleInit() {
    await this.ensurePredefinedTasks();
    for (const task of await this.tasks.find()) {
      await this.registerTask(task);
    }
  }

  listActions() {
    return this.actions.listActions();
  }

  async list() {
    return (await this.tasks.find({ order: { updatedAt: 'DESC' } })).map(
      this.toDto,
    );
  }

  async get(id: string) {
    return this.toDto(await this.getEntity(id));
  }

  async create(dto: CreateScheduledTaskDto) {
    const cronExpression = this.validateCronExpression(dto.cronExpression);
    const actionType = dto.actionType;
    const payload = this.actions.normalizePayload(
      actionType,
      dto.payload ? { ...dto.payload } : dto.payload,
    );
    const task = this.tasks.create({
      name: dto.name.trim(),
      enabled: dto.enabled ?? true,
      kind: ScheduledTaskKind.Custom,
      predefinedKey: null,
      cronExpression,
      actionType,
      payloadJson: payload ? JSON.stringify(payload) : null,
      lastStatus: ScheduledTaskLastStatus.NeverRun,
      lastRunAt: null,
      lastError: null,
      nextRunAt: dto.enabled === false ? null : this.nextRun(cronExpression),
    });
    const saved = await this.tasks.save(task);
    await this.registerTask(saved);
    return this.toDto(saved);
  }

  async update(id: string, dto: UpdateScheduledTaskDto) {
    const task = await this.getEntity(id);
    if (dto.name !== undefined) {
      task.name = dto.name.trim();
    }
    if (dto.enabled !== undefined) {
      task.enabled = dto.enabled;
    }
    if (dto.cronExpression !== undefined) {
      task.cronExpression = this.validateCronExpression(dto.cronExpression);
    }
    if (dto.actionType !== undefined) {
      task.actionType = dto.actionType;
    }
    if (dto.payload !== undefined || dto.actionType !== undefined) {
      const payload = this.actions.normalizePayload(
        task.actionType,
        dto.payload !== undefined
          ? dto.payload
            ? { ...dto.payload }
            : dto.payload
          : this.parsePayload(task),
      );
      task.payloadJson = payload ? JSON.stringify(payload) : null;
    }
    task.nextRunAt = task.enabled ? this.nextRun(task.cronExpression) : null;

    const saved = await this.tasks.save(task);
    await this.registerTask(saved);
    return this.toDto(saved);
  }

  async remove(id: string) {
    const task = await this.getEntity(id);
    if (task.kind === ScheduledTaskKind.Predefined) {
      throw new BadRequestException(
        'Predefined scheduled tasks cannot be deleted.',
      );
    }
    this.unregisterTask(task.id);
    await this.tasks.remove(task);
    return this.toDto(task);
  }

  async runNow(id: string) {
    const task = await this.getEntity(id);
    await this.runTask(task.id);
    return this.get(id);
  }

  private async runTask(id: string) {
    if (this.runningTasks.has(id)) {
      return;
    }

    const task = await this.tasks.findOneBy({ id });
    if (!task) {
      this.unregisterTask(id);
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
      task.nextRunAt = task.enabled ? this.nextRun(task.cronExpression) : null;
      await this.tasks.save(task);
      this.runningTasks.delete(id);
    }
  }

  private async ensurePredefinedTasks() {
    const existingTasks = await this.tasks.find({
      where: { predefinedKey: In(predefinedTasks.map((task) => task.key)) },
    });
    const existingKeys = new Set(
      existingTasks.map((task) => task.predefinedKey),
    );

    for (const predefined of predefinedTasks) {
      if (existingKeys.has(predefined.key)) {
        continue;
      }

      const cronExpression = this.validateCronExpression(
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
          nextRunAt: predefined.enabled ? this.nextRun(cronExpression) : null,
        }),
      );
    }
  }

  private async getEntity(id: string) {
    const task = await this.tasks.findOneBy({ id });
    if (!task) {
      throw new NotFoundException(`Scheduled task "${id}" was not found.`);
    }
    return task;
  }

  private async registerTask(task: ScheduledTask) {
    this.unregisterTask(task.id);
    if (!task.enabled) {
      return;
    }

    const job = CronJob.from({
      cronTime: task.cronExpression,
      onTick: () => void this.runTask(task.id),
      start: false,
    });
    this.scheduler.addCronJob(taskJobName(task.id), job);
    job.start();
  }

  private unregisterTask(id: string) {
    const name = taskJobName(id);
    try {
      this.scheduler.deleteCronJob(name);
    } catch {
      return;
    }
  }

  private validateCronExpression(value: string) {
    const cronExpression = value.trim();
    const result = validateCronExpression(cronExpression);
    if (!result.valid) {
      throw new BadRequestException(
        result.error?.message ?? 'Invalid cron expression.',
      );
    }
    return cronExpression;
  }

  private nextRun(cronExpression: string) {
    try {
      return sendAt(cronExpression).toJSDate();
    } catch (error) {
      throw new BadRequestException(getErrorMessage(error));
    }
  }

  private parsePayload(task: Pick<ScheduledTask, 'payloadJson'>) {
    if (!task.payloadJson) {
      return null;
    }
    return JSON.parse(task.payloadJson) as Record<string, unknown>;
  }

  private toDto(task: ScheduledTask): ScheduledTaskDto {
    return {
      id: task.id,
      name: task.name,
      enabled: task.enabled,
      kind: task.kind,
      predefinedKey: task.predefinedKey,
      cronExpression: task.cronExpression,
      actionType: task.actionType as ScheduledTaskActionType,
      payload: task.payloadJson
        ? (JSON.parse(task.payloadJson) as Record<string, unknown>)
        : null,
      lastRunAt: toIso(task.lastRunAt),
      nextRunAt: toIso(task.nextRunAt),
      lastStatus: task.lastStatus,
      lastError: task.lastError,
      createdAt: toIso(task.createdAt) ?? new Date().toISOString(),
      updatedAt: toIso(task.updatedAt) ?? new Date().toISOString(),
    };
  }
}
