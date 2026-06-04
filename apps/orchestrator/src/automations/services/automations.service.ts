import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ApplicationProfileMode } from '../../android-apps/application-profile-mode';
import { AndroidAppsStateService } from '../../android-apps/common/services/android-apps-state.service';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationDefinitionService } from '../definition/automation-definition.service';
import { AutomationDefinition } from '../definition/automation-definition.types';
import {
  AutomationCommandDto,
  AutomationDto,
  AutomationRunDto,
  AutomationTriggerDto,
  CreateAutomationDto,
  CreateAutomationTriggerDto,
  RunAutomationDto,
  UpdateAutomationDto,
  UpdateAutomationTriggerDto,
} from '../dto/automation.dto';
import {
  Automation,
  AutomationLastStatus,
} from '../entities/automation.entity';
import {
  AutomationRun,
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import {
  AutomationStartPolicy,
  AutomationTrigger,
  AutomationTriggerType,
} from '../entities/automation-trigger.entity';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationTriggersRepository } from '../persistence/automation-triggers.repository';
import { AutomationsRepository } from '../persistence/automations.repository';
import {
  AutomationRunStartPolicy,
  AutomationRunnerService,
} from '../runner/automation-runner.service';
import { AutomationStepResult } from '../runner/automation-runner.types';
import { AutomationCronRegistryService } from '../scheduler/automation-cron-registry.service';
import { AutomationScheduleService } from '../scheduler/automation-schedule.service';

const toIso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;

interface ScheduleTriggerConfig {
  cronExpression: string;
  startPolicy: AutomationStartPolicy;
}

@Injectable()
export class AutomationsService implements OnModuleInit {
  constructor(
    private readonly automations: AutomationsRepository,
    private readonly triggers: AutomationTriggersRepository,
    private readonly runs: AutomationRunsRepository,
    private readonly apps: AndroidAppsStateService,
    private readonly definitions: AutomationDefinitionService,
    private readonly registry: AutomationCommandRegistryService,
    private readonly runner: AutomationRunnerService,
    private readonly cronRegistry: AutomationCronRegistryService,
    private readonly schedule: AutomationScheduleService,
  ) {}

  async onModuleInit() {
    for (const trigger of await this.triggers.findAll()) {
      this.registerTrigger(trigger);
    }
  }

  listCommands(): AutomationCommandDto[] {
    return this.registry.listCommands();
  }

  async list(ownerUserId: string) {
    const automations = await this.automations.listByOwner(ownerUserId);
    await Promise.all(
      automations.map((automation) =>
        this.backfillAutomationLastRun(automation),
      ),
    );
    return automations.map((automation) => this.toDto(automation));
  }

  async get(ownerUserId: string, id: string) {
    const automation = await this.getEntity(ownerUserId, id);
    await this.backfillAutomationLastRun(automation);
    return this.toDto(automation);
  }

  async create(dto: CreateAutomationDto) {
    const definition = this.definitionFromDto(dto);
    const automation = this.automations.create({
      ownerUserId: dto.ownerUserId.trim(),
      name: definition.metadata.name,
      description: definition.metadata.description ?? null,
      definitionJson: JSON.stringify(definition),
      lastStatus: AutomationLastStatus.NeverRun,
      lastRunAt: null,
      lastError: null,
    });
    return this.toDto(await this.automations.save(automation));
  }

  async update(ownerUserId: string, id: string, dto: UpdateAutomationDto) {
    const automation = await this.getEntity(ownerUserId, id);
    if (dto.yaml !== undefined || dto.definition !== undefined) {
      const definition = this.definitionFromDto(dto);
      automation.name = definition.metadata.name;
      automation.description = definition.metadata.description ?? null;
      automation.definitionJson = JSON.stringify(definition);
    }

    return this.toDto(await this.automations.save(automation));
  }

  async remove(ownerUserId: string, id: string) {
    const automation = await this.getEntity(ownerUserId, id);
    for (const trigger of await this.triggers.listByOwner(ownerUserId)) {
      if (trigger.automationId === automation.id) {
        this.cronRegistry.unregisterTrigger(trigger.id);
      }
    }
    await this.triggers.deleteByAutomation(ownerUserId, automation.id);
    await this.automations.remove(automation);
    return this.toDto(automation);
  }

  validateYaml(yaml: string) {
    return this.definitions.validateYaml(yaml);
  }

  async run(ownerUserId: string, id: string, dto: RunAutomationDto) {
    const automation = await this.getEntity(ownerUserId, id);
    await this.assertTargetApplication(ownerUserId, dto.targetApplicationId);
    const run = await this.runner.enqueue(
      automation,
      AutomationRunTrigger.Manual,
      {
        targetApplicationId: dto.targetApplicationId,
        targetProfileMode: dto.profileMode ?? ApplicationProfileMode.Persistent,
        targetProfileName: dto.profileName ?? 'default',
        startPolicy: this.toRunnerStartPolicy(
          dto.startPolicy ?? AutomationStartPolicy.RequireRunning,
        ),
      },
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

  async listActiveRuns(ownerUserId: string) {
    return (await this.runs.listActive(ownerUserId)).map((run) =>
      this.toRunDto(run),
    );
  }

  async getRun(ownerUserId: string, id: string) {
    const run = await this.runs.findByOwnerAndId(ownerUserId, id);
    if (!run) {
      throw new NotFoundException(`Automation run "${id}" was not found.`);
    }
    return this.toRunDto(run);
  }

  async listTriggers(ownerUserId: string) {
    return (await this.triggers.listByOwner(ownerUserId)).map((trigger) =>
      this.toTriggerDto(trigger),
    );
  }

  async getTrigger(ownerUserId: string, id: string) {
    return this.toTriggerDto(await this.getTriggerEntity(ownerUserId, id));
  }

  async createTrigger(dto: CreateAutomationTriggerDto) {
    const ownerUserId = dto.ownerUserId.trim();
    await this.getEntity(ownerUserId, dto.automationId);
    await this.assertTargetApplication(ownerUserId, dto.targetApplicationId);
    const triggerConfig = this.normalizeTriggerConfig(
      dto.triggerType,
      dto.triggerConfig,
    );
    const trigger = this.triggers.create({
      ownerUserId,
      name: dto.name.trim(),
      automationId: dto.automationId,
      targetApplicationId: dto.targetApplicationId,
      profileMode: dto.profileMode ?? ApplicationProfileMode.Persistent,
      profileName: dto.profileName?.trim() || 'default',
      enabled: dto.enabled !== false,
      triggerType: dto.triggerType,
      triggerConfigJson: JSON.stringify(triggerConfig),
      lastStatus: AutomationLastStatus.NeverRun,
      lastRunAt: null,
      lastError: null,
      nextRunAt:
        dto.enabled === false
          ? null
          : this.nextRunForTrigger(dto.triggerType, triggerConfig),
    });
    const saved = await this.triggers.save(trigger);
    this.registerTrigger(saved);
    return this.toTriggerDto(saved);
  }

  async updateTrigger(
    ownerUserId: string,
    id: string,
    dto: UpdateAutomationTriggerDto,
  ) {
    const trigger = await this.getTriggerEntity(ownerUserId, id);
    if (dto.automationId !== undefined) {
      await this.getEntity(ownerUserId, dto.automationId);
      trigger.automationId = dto.automationId;
    }
    if (dto.name !== undefined) {
      trigger.name = dto.name.trim();
    }
    if (dto.targetApplicationId !== undefined) {
      await this.assertTargetApplication(ownerUserId, dto.targetApplicationId);
      trigger.targetApplicationId = dto.targetApplicationId;
    }
    if (dto.profileMode !== undefined) {
      trigger.profileMode =
        dto.profileMode ?? ApplicationProfileMode.Persistent;
    }
    if (dto.profileName !== undefined) {
      trigger.profileName = dto.profileName?.trim() || 'default';
    }
    if (dto.enabled !== undefined) {
      trigger.enabled = dto.enabled;
    }
    if (dto.triggerType !== undefined) {
      trigger.triggerType = dto.triggerType;
    }
    if (dto.triggerConfig !== undefined || dto.triggerType !== undefined) {
      const triggerConfig = this.normalizeTriggerConfig(
        trigger.triggerType,
        dto.triggerConfig ?? this.parseTriggerConfig(trigger),
      );
      trigger.triggerConfigJson = JSON.stringify(triggerConfig);
    }
    trigger.nextRunAt = trigger.enabled
      ? this.nextRunForTrigger(
          trigger.triggerType,
          this.parseTriggerConfig(trigger),
        )
      : null;
    const saved = await this.triggers.save(trigger);
    this.registerTrigger(saved);
    return this.toTriggerDto(saved);
  }

  async removeTrigger(ownerUserId: string, id: string) {
    const trigger = await this.getTriggerEntity(ownerUserId, id);
    this.cronRegistry.unregisterTrigger(trigger.id);
    await this.triggers.remove(trigger);
    return this.toTriggerDto(trigger);
  }

  async runTrigger(ownerUserId: string, id: string) {
    const trigger = await this.getTriggerEntity(ownerUserId, id);
    const automation = await this.getEntity(ownerUserId, trigger.automationId);
    const run = await this.enqueueTriggerRun(trigger, automation);
    return this.toRunDto(run);
  }

  private async enqueueTriggerRun(
    trigger: AutomationTrigger,
    automation: Automation,
  ) {
    const config = this.parseScheduleTriggerConfig(trigger);
    const run = await this.runner.enqueue(
      automation,
      AutomationRunTrigger.Schedule,
      {
        automationTriggerId: trigger.id,
        targetApplicationId: trigger.targetApplicationId,
        targetProfileMode:
          trigger.profileMode ?? ApplicationProfileMode.Persistent,
        targetProfileName: trigger.profileName ?? 'default',
        startPolicy: this.toRunnerStartPolicy(config.startPolicy),
      },
    );
    const now = new Date();
    automation.lastStatus = AutomationLastStatus.Running;
    automation.lastRunAt = now;
    automation.lastError = null;
    trigger.lastStatus = AutomationLastStatus.Running;
    trigger.lastRunAt = now;
    trigger.lastError = null;
    trigger.nextRunAt = trigger.enabled
      ? this.schedule.nextRun(config.cronExpression)
      : null;
    await Promise.all([
      this.automations.save(automation),
      this.triggers.save(trigger),
    ]);
    return run;
  }

  private async getEntity(ownerUserId: string, id: string) {
    const automation = await this.automations.findByOwnerAndId(ownerUserId, id);
    if (!automation) {
      throw new NotFoundException(`Automation "${id}" was not found.`);
    }
    return automation;
  }

  private async getTriggerEntity(ownerUserId: string, id: string) {
    const trigger = await this.triggers.findByOwnerAndId(ownerUserId, id);
    if (!trigger) {
      throw new NotFoundException(`Automation trigger "${id}" was not found.`);
    }
    return trigger;
  }

  private async assertTargetApplication(
    ownerUserId: string,
    id?: string | null,
  ) {
    if (!id) {
      throw new BadRequestException('targetApplicationId is required.');
    }
    const app = await this.apps.get(id);
    if (app.ownerUserId !== ownerUserId) {
      throw new NotFoundException(`Application "${id}" was not found.`);
    }
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

  private normalizeTriggerConfig(
    triggerType: AutomationTriggerType,
    config: Record<string, unknown>,
  ) {
    if (triggerType !== AutomationTriggerType.Schedule) {
      throw new BadRequestException(
        `Automation trigger type "${triggerType}" is not supported yet.`,
      );
    }
    const cronExpressionValue = config.cronExpression;
    if (typeof cronExpressionValue !== 'string') {
      throw new BadRequestException(
        'triggerConfig.cronExpression is required for schedule triggers.',
      );
    }
    const startPolicy =
      config.startPolicy === AutomationStartPolicy.RequireRunning
        ? AutomationStartPolicy.RequireRunning
        : AutomationStartPolicy.StartIfNeeded;

    return {
      cronExpression: this.schedule.validateCronExpression(cronExpressionValue),
      startPolicy,
    } satisfies ScheduleTriggerConfig;
  }

  private nextRunForTrigger(
    triggerType: AutomationTriggerType,
    config: Record<string, unknown>,
  ) {
    if (triggerType !== AutomationTriggerType.Schedule) {
      return null;
    }
    return this.schedule.nextRun(
      (config as unknown as ScheduleTriggerConfig).cronExpression,
    );
  }

  private registerTrigger(trigger: AutomationTrigger) {
    const cronExpression =
      trigger.triggerType === AutomationTriggerType.Schedule
        ? this.parseScheduleTriggerConfig(trigger).cronExpression
        : null;
    this.cronRegistry.registerTrigger(trigger, cronExpression, () => {
      void this.runScheduledTrigger(trigger.id);
    });
  }

  private async runScheduledTrigger(id: string) {
    const trigger = await this.triggers.findEnabledSchedule(id);
    if (!trigger) {
      return;
    }
    const automation = await this.automations.findByOwnerAndId(
      trigger.ownerUserId,
      trigger.automationId,
    );
    if (!automation) {
      return;
    }
    try {
      await this.enqueueTriggerRun(trigger, automation);
    } catch (error) {
      trigger.lastStatus = AutomationLastStatus.Failed;
      trigger.lastError =
        error instanceof Error ? error.message : String(error);
      trigger.nextRunAt = this.schedule.nextRun(
        this.parseScheduleTriggerConfig(trigger).cronExpression,
      );
      await this.triggers.save(trigger);
    }
  }

  private parseTriggerConfig(trigger: AutomationTrigger) {
    return JSON.parse(trigger.triggerConfigJson) as Record<string, unknown>;
  }

  private parseScheduleTriggerConfig(trigger: AutomationTrigger) {
    return this.normalizeTriggerConfig(
      AutomationTriggerType.Schedule,
      this.parseTriggerConfig(trigger),
    );
  }

  private toRunnerStartPolicy(policy: AutomationStartPolicy) {
    return policy === AutomationStartPolicy.StartIfNeeded
      ? AutomationRunStartPolicy.StartIfNeeded
      : AutomationRunStartPolicy.RequireRunning;
  }

  private async backfillAutomationLastRun(automation: Automation) {
    if (automation.lastRunAt) {
      return;
    }

    const run = await this.runs.findLatestForAutomation(
      automation.ownerUserId,
      automation.id,
    );
    if (!run) {
      return;
    }

    automation.lastRunAt = run.completedAt ?? run.startedAt ?? run.createdAt;
    automation.lastStatus =
      run.status === AutomationRunStatus.Success
        ? AutomationLastStatus.Success
        : run.status === AutomationRunStatus.Failed ||
            run.status === AutomationRunStatus.Canceled
          ? AutomationLastStatus.Failed
          : AutomationLastStatus.Running;
    automation.lastError = run.error;
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
      lastRunAt: toIso(automation.lastRunAt),
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
      automationTriggerId: run.automationTriggerId,
      ownerUserId: run.ownerUserId,
      targetApplicationId: run.targetApplicationId,
      targetProfileMode: run.targetProfileMode,
      targetProfileName: run.targetProfileName,
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

  private toTriggerDto(trigger: AutomationTrigger): AutomationTriggerDto {
    return {
      id: trigger.id,
      ownerUserId: trigger.ownerUserId,
      name: trigger.name,
      automationId: trigger.automationId,
      targetApplicationId: trigger.targetApplicationId,
      profileMode: trigger.profileMode,
      profileName: trigger.profileName,
      enabled: trigger.enabled,
      triggerType: trigger.triggerType,
      triggerConfig: this.parseTriggerConfig(trigger),
      lastRunAt: toIso(trigger.lastRunAt),
      nextRunAt: toIso(trigger.nextRunAt),
      lastStatus: trigger.lastStatus,
      lastError: trigger.lastError,
      createdAt: toIso(trigger.createdAt) ?? new Date().toISOString(),
      updatedAt: toIso(trigger.updatedAt) ?? new Date().toISOString(),
    };
  }
}
