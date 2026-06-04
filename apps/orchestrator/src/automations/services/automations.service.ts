import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  AutomationCommandDto,
  AutomationDto,
  AutomationRunDto,
  CreateAutomationDto,
  UpdateAutomationDto,
} from '../dto/automation.dto';
import {
  Automation,
  AutomationLastStatus,
} from '../entities/automation.entity';
import {
  AutomationRun,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import { AutomationDefinitionService } from '../definition/automation-definition.service';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationsRepository } from '../persistence/automations.repository';
import { AutomationRunnerService } from '../runner/automation-runner.service';
import { AutomationCronRegistryService } from '../scheduler/automation-cron-registry.service';
import { AutomationScheduleService } from '../scheduler/automation-schedule.service';
import { AutomationStepResult } from '../runner/automation-runner.types';
import { AutomationDefinition } from '../definition/automation-definition.types';

const toIso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;

@Injectable()
export class AutomationsService implements OnModuleInit {
  constructor(
    private readonly automations: AutomationsRepository,
    private readonly runs: AutomationRunsRepository,
    private readonly definitions: AutomationDefinitionService,
    private readonly registry: AutomationCommandRegistryService,
    private readonly runner: AutomationRunnerService,
    private readonly cronRegistry: AutomationCronRegistryService,
    private readonly schedule: AutomationScheduleService,
  ) {}

  async onModuleInit() {
    for (const automation of await this.automations.findAll()) {
      this.registerAutomation(automation);
    }
  }

  listCommands(): AutomationCommandDto[] {
    return this.registry.listCommands();
  }

  async list(ownerUserId: string) {
    return (await this.automations.listByOwner(ownerUserId)).map((automation) =>
      this.toDto(automation),
    );
  }

  async get(ownerUserId: string, id: string) {
    return this.toDto(await this.getEntity(ownerUserId, id));
  }

  async create(dto: CreateAutomationDto) {
    const definition = this.definitionFromDto(dto);
    const scheduleFields = this.normalizeSchedule(dto);
    const automation = this.automations.create({
      ownerUserId: dto.ownerUserId.trim(),
      name: definition.metadata.name,
      description: definition.metadata.description ?? null,
      definitionJson: JSON.stringify(definition),
      lastStatus: AutomationLastStatus.NeverRun,
      lastRunAt: null,
      lastError: null,
      ...scheduleFields,
    });
    const saved = await this.automations.save(automation);
    this.registerAutomation(saved);
    return this.toDto(saved);
  }

  async update(ownerUserId: string, id: string, dto: UpdateAutomationDto) {
    const automation = await this.getEntity(ownerUserId, id);
    if (dto.yaml !== undefined || dto.definition !== undefined) {
      const definition = this.definitionFromDto(dto);
      automation.name = definition.metadata.name;
      automation.description = definition.metadata.description ?? null;
      automation.definitionJson = JSON.stringify(definition);
    }

    if (
      dto.scheduleEnabled !== undefined ||
      dto.cronExpression !== undefined ||
      dto.targetApplicationId !== undefined
    ) {
      Object.assign(automation, this.normalizeSchedule(dto, automation));
    }

    const saved = await this.automations.save(automation);
    this.registerAutomation(saved);
    return this.toDto(saved);
  }

  async remove(ownerUserId: string, id: string) {
    const automation = await this.getEntity(ownerUserId, id);
    this.cronRegistry.unregisterAutomation(automation.id);
    await this.automations.remove(automation);
    return this.toDto(automation);
  }

  validateYaml(yaml: string) {
    return this.definitions.validateYaml(yaml);
  }

  async run(
    ownerUserId: string,
    id: string,
    targetApplicationId?: string | null,
  ) {
    const automation = await this.getEntity(ownerUserId, id);
    const run = await this.runner.enqueue(
      automation,
      AutomationRunTrigger.Manual,
      targetApplicationId,
    );
    automation.lastStatus = AutomationLastStatus.Running;
    automation.lastRunAt = new Date();
    automation.lastError = null;
    await this.automations.save(automation);
    return this.toRunDto(run);
  }

  async listRuns(ownerUserId: string, automationId: string, limit?: number) {
    await this.getEntity(ownerUserId, automationId);
    return (
      await this.runs.listForAutomation(ownerUserId, automationId, limit)
    ).map((run) => this.toRunDto(run));
  }

  async getRun(ownerUserId: string, id: string) {
    const run = await this.runs.findByOwnerAndId(ownerUserId, id);
    if (!run) {
      throw new NotFoundException(`Automation run "${id}" was not found.`);
    }
    return this.toRunDto(run);
  }

  private async getEntity(ownerUserId: string, id: string) {
    const automation = await this.automations.findByOwnerAndId(ownerUserId, id);
    if (!automation) {
      throw new NotFoundException(`Automation "${id}" was not found.`);
    }
    return automation;
  }

  private definitionFromDto(dto: { yaml?: string; definition?: unknown }) {
    if (dto.yaml !== undefined) {
      return this.definitions.parseYaml(dto.yaml);
    }
    if (dto.definition !== undefined) {
      return this.definitions.normalize(dto.definition);
    }
    throw new BadRequestException(
      'An automation definition or YAML is required.',
    );
  }

  private normalizeSchedule(
    dto: {
      scheduleEnabled?: boolean;
      cronExpression?: string | null;
      targetApplicationId?: string | null;
    },
    existing?: Automation,
  ) {
    const scheduleEnabled =
      dto.scheduleEnabled ?? existing?.scheduleEnabled ?? false;
    const rawCron = dto.cronExpression ?? existing?.cronExpression ?? null;
    const cronExpression =
      rawCron && scheduleEnabled
        ? this.schedule.validateCronExpression(rawCron)
        : rawCron
          ? rawCron.trim()
          : null;
    const targetApplicationId =
      dto.targetApplicationId !== undefined
        ? dto.targetApplicationId
        : (existing?.targetApplicationId ?? null);

    if (scheduleEnabled && !cronExpression) {
      throw new BadRequestException(
        'cronExpression is required when schedule is enabled.',
      );
    }
    if (scheduleEnabled && !targetApplicationId) {
      throw new BadRequestException(
        'targetApplicationId is required when schedule is enabled.',
      );
    }

    return {
      scheduleEnabled,
      cronExpression,
      targetApplicationId,
      nextRunAt:
        scheduleEnabled && cronExpression
          ? this.schedule.nextRun(cronExpression)
          : null,
    };
  }

  private registerAutomation(automation: Automation) {
    this.cronRegistry.registerAutomation(automation, () => {
      void this.runScheduledAutomation(automation.id);
    });
  }

  private async runScheduledAutomation(id: string) {
    const automations = await this.automations.findByIds([id]);
    const automation = automations[0];
    if (!automation || !automation.targetApplicationId) {
      return;
    }

    await this.runner.enqueue(
      automation,
      AutomationRunTrigger.Schedule,
      automation.targetApplicationId,
    );
    automation.lastStatus = AutomationLastStatus.Running;
    automation.lastRunAt = new Date();
    automation.lastError = null;
    automation.nextRunAt = automation.cronExpression
      ? this.schedule.nextRun(automation.cronExpression)
      : null;
    await this.automations.save(automation);
  }

  private toDto(automation: Automation): AutomationDto {
    const definition = JSON.parse(
      automation.definitionJson,
    ) as AutomationDefinition;
    return {
      id: automation.id,
      ownerUserId: automation.ownerUserId,
      name: automation.name,
      description: automation.description,
      definition,
      yaml: this.definitions.toYaml(definition),
      scheduleEnabled: automation.scheduleEnabled,
      cronExpression: automation.cronExpression,
      targetApplicationId: automation.targetApplicationId,
      lastRunAt: toIso(automation.lastRunAt),
      nextRunAt: toIso(automation.nextRunAt),
      lastStatus: automation.lastStatus,
      lastError: automation.lastError,
      createdAt: toIso(automation.createdAt) ?? new Date().toISOString(),
      updatedAt: toIso(automation.updatedAt) ?? new Date().toISOString(),
    };
  }

  private toRunDto(run: AutomationRun): AutomationRunDto {
    return {
      id: run.id,
      automationId: run.automationId,
      ownerUserId: run.ownerUserId,
      targetApplicationId: run.targetApplicationId,
      trigger: run.trigger,
      status: run.status,
      startedAt: toIso(run.startedAt),
      completedAt: toIso(run.completedAt),
      stepResults: JSON.parse(run.stepResultsJson) as AutomationStepResult[],
      error: run.error,
      createdAt: toIso(run.createdAt) ?? new Date().toISOString(),
      updatedAt: toIso(run.updatedAt) ?? new Date().toISOString(),
    };
  }
}
