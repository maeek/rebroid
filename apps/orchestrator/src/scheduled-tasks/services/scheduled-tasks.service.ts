import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  nextCronRun,
  normalizeCronExpression,
} from '../../common/cron-schedule';
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
import { ScheduledTasksRepository } from '../persistence/scheduled-tasks.repository';
import { ScheduledTaskActionsService } from './scheduled-task-actions.service';
import { ScheduledTaskCronRegistryService } from './scheduled-task-cron-registry.service';
import { ScheduledTaskPredefinedSeederService } from './scheduled-task-predefined-seeder.service';
import { ScheduledTaskRunnerService } from './scheduled-task-runner.service';
import { getErrorMessage } from '../../common/error-message';

const toIso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;

@Injectable()
export class ScheduledTasksService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledTasksService.name);

  constructor(
    private readonly tasks: ScheduledTasksRepository,
    private readonly actions: ScheduledTaskActionsService,
    private readonly cronRegistry: ScheduledTaskCronRegistryService,
    private readonly predefinedSeeder: ScheduledTaskPredefinedSeederService,
    private readonly runner: ScheduledTaskRunnerService,
  ) {}

  async onModuleInit() {
    await this.predefinedSeeder.ensurePredefinedTasks();
    for (const task of await this.tasks.findAll()) {
      this.registerTask(task);
    }
  }

  listActions() {
    return this.actions.listActions();
  }

  async list() {
    return (await this.tasks.listForDisplay()).map(this.toDto);
  }

  async get(id: string) {
    return this.toDto(await this.getEntity(id));
  }

  async create(dto: CreateScheduledTaskDto) {
    const cronExpression = normalizeCronExpression(dto.cronExpression);
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
      nextRunAt: dto.enabled === false ? null : nextCronRun(cronExpression),
    });
    const saved = await this.tasks.save(task);
    this.registerTask(saved);
    return this.toDto(saved);
  }

  async update(id: string, dto: UpdateScheduledTaskDto) {
    if (
      dto.payload !== undefined &&
      dto.name === undefined &&
      dto.enabled === undefined &&
      dto.cronExpression === undefined &&
      dto.actionType === undefined
    ) {
      const task = await this.getEntity(id);
      const payload = this.actions.normalizePayload(
        task.actionType,
        dto.payload ? { ...dto.payload } : null,
      );
      const result = await this.tasks.updatePayload(
        id,
        task.actionType,
        payload ? JSON.stringify(payload) : null,
      );
      const current = await this.getEntity(id);
      if (!result.affected) {
        throw new ConflictException('The scheduled task action changed.');
      }
      return this.toDto(current);
    }
    const saved = await this.tasks.updateConfiguration(id, (current) => {
      const cronExpression =
        dto.cronExpression === undefined
          ? current.cronExpression
          : normalizeCronExpression(dto.cronExpression);
      const actionType = dto.actionType ?? current.actionType;
      const enabled = dto.enabled ?? current.enabled;
      let payloadJson: string | null | undefined;
      if (dto.payload !== undefined || dto.actionType !== undefined) {
        const payload = this.actions.normalizePayload(
          actionType,
          dto.payload === undefined
            ? this.runner.parsePayload(current)
            : dto.payload && { ...dto.payload },
        );
        payloadJson = payload ? JSON.stringify(payload) : null;
      }

      return {
        name: dto.name?.trim(),
        enabled: dto.enabled,
        cronExpression:
          dto.cronExpression === undefined ? undefined : cronExpression,
        actionType: dto.actionType,
        payloadJson,
        nextRunAt: enabled ? nextCronRun(cronExpression) : null,
      };
    });
    if (!saved) {
      throw new NotFoundException(`Scheduled task "${id}" was not found.`);
    }
    this.registerTask(saved);
    return this.toDto(saved);
  }

  async remove(id: string) {
    const task = await this.getEntity(id);
    if (task.kind === ScheduledTaskKind.Predefined) {
      throw new BadRequestException(
        'Predefined scheduled tasks cannot be deleted.',
      );
    }
    const removed = this.toDto(task);
    await this.tasks.remove(task);
    this.cronRegistry.unregisterTask(id);
    return removed;
  }

  async runNow(id: string) {
    await this.runner.runTask(id);
    return this.get(id);
  }

  private async getEntity(id: string) {
    const task = await this.tasks.findById(id);
    if (!task) {
      throw new NotFoundException(`Scheduled task "${id}" was not found.`);
    }
    return task;
  }

  private registerTask(task: ScheduledTask) {
    this.cronRegistry.registerTask(task, (tick) => {
      void this.runner.runTask(task.id, tick).catch((error: unknown) => {
        this.logger.error(
          `Could not execute scheduled task "${task.id}": ${getErrorMessage(error)}`,
        );
      });
    });
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
