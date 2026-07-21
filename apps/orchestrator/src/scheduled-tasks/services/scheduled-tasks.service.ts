import {
  BadRequestException,
  Injectable,
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

const toIso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;

@Injectable()
export class ScheduledTasksService implements OnModuleInit {
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
    const task = await this.getEntity(id);
    if (dto.name !== undefined) {
      task.name = dto.name.trim();
    }
    if (dto.enabled !== undefined) {
      task.enabled = dto.enabled;
    }
    if (dto.cronExpression !== undefined) {
      task.cronExpression = normalizeCronExpression(dto.cronExpression);
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
          : this.runner.parsePayload(task),
      );
      task.payloadJson = payload ? JSON.stringify(payload) : null;
    }
    task.nextRunAt = task.enabled ? nextCronRun(task.cronExpression) : null;

    const saved = await this.tasks.save(task);
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
    this.cronRegistry.unregisterTask(task.id);
    await this.tasks.remove(task);
    return this.toDto(task);
  }

  async runNow(id: string) {
    const task = await this.getEntity(id);
    await this.runner.runTask(task.id);
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
    this.cronRegistry.registerTask(
      task,
      () => void this.runner.runTask(task.id),
    );
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
