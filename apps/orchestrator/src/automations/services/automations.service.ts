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
import { AutomationDefinition } from '@rebroid/automation-core/definition';
import {
  AutomationCommandDto,
  AutomationsGridPageDto,
  AutomationTriggersGridPageDto,
  AutomationRunEventDto,
  AutomationRunEventStreamTokenDto,
  AutomationYamlDraftDto,
  CreateAutomationDto,
  CreateAutomationTriggerDto,
  DraftAutomationYamlDto,
  ListAutomationTriggersGridQueryDto,
  ListAutomationsGridQueryDto,
  RunAdHocAiAutomationDto,
  RunAutomationDto,
  UpdateAutomationDto,
  UpdateAutomationTriggerDto,
} from '../dto/automation.dto';
import {
  Automation,
  AutomationLastStatus,
} from '../entities/automation.entity';
import {
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import {
  AutomationStartPolicy,
  AutomationTrigger,
} from '../entities/automation-trigger.entity';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationTriggersRepository } from '../persistence/automation-triggers.repository';
import { AutomationsRepository } from '../persistence/automations.repository';
import {
  AutomationRunStartPolicy,
  AutomationRunnerService,
} from '../runner/automation-runner.service';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationRunEventStreamService } from '../events/automation-run-event-stream.service';
import { normalizeAutomationTags } from '../tags/automation-tags';
import { AutomationTriggerSchedulerService } from './automation-trigger-scheduler.service';
import { AutomationsDtoMapper } from './automations-dto-mapper.service';
import {
  automationGridFacets,
  automationTriggerGridFacets,
  filterAutomationGridItems,
  filterAutomationTriggerGridItems,
  sortAutomationGridItems,
  sortAutomationTriggerGridItems,
} from './automations-grid-utils';

const stringifyTags = (value: unknown) =>
  JSON.stringify(normalizeAutomationTags(value, 'tags') ?? []);

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
    private readonly events: AutomationRunEventBus,
    private readonly eventStream: AutomationRunEventStreamService,
    private readonly mapper: AutomationsDtoMapper,
    private readonly triggerScheduler: AutomationTriggerSchedulerService,
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
    return automations.map((automation) => this.mapper.automation(automation));
  }

  async listGrid(
    query: ListAutomationsGridQueryDto,
  ): Promise<AutomationsGridPageDto> {
    const ownerUserId = query.ownerUserId.trim();
    const page = Math.max(Math.trunc(query.page ?? 1), 1);
    const pageSize = Math.min(
      Math.max(Math.trunc(query.pageSize ?? 20), 1),
      100,
    );
    const [automations, triggers] = await Promise.all([
      this.automations.listByOwner(ownerUserId),
      this.triggers.listByOwner(ownerUserId),
    ]);
    await Promise.all(
      automations.map((automation) =>
        this.backfillAutomationLastRun(automation),
      ),
    );

    const targetApplicationIdsByAutomation = new Map<string, Set<string>>();
    for (const trigger of triggers) {
      const appIds =
        targetApplicationIdsByAutomation.get(trigger.automationId) ??
        new Set<string>();
      appIds.add(trigger.targetApplicationId);
      targetApplicationIdsByAutomation.set(trigger.automationId, appIds);
    }

    const automationDtos = automations.map((automation) =>
      this.mapper.automation(automation),
    );
    const facets = automationGridFacets(
      automationDtos,
      triggers.map((trigger) => trigger.targetApplicationId),
    );
    const lastRun = query.lastRun ?? 'all';
    const filtered = filterAutomationGridItems({
      automations: automationDtos,
      lastRun,
      query,
      targetApplicationIdsByAutomation,
    });

    const sorted = sortAutomationGridItems(filtered, query.sort);
    const offset = (page - 1) * pageSize;
    return {
      items: sorted.slice(offset, offset + pageSize),
      total: sorted.length,
      page,
      pageSize,
      facets,
    };
  }

  async get(ownerUserId: string, id: string) {
    const automation = await this.getEntity(ownerUserId, id);
    await this.backfillAutomationLastRun(automation);
    return this.mapper.automation(automation);
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
    return this.mapper.automation(await this.automations.save(automation));
  }

  async update(ownerUserId: string, id: string, dto: UpdateAutomationDto) {
    const automation = await this.getEntity(ownerUserId, id);
    if (dto.yaml !== undefined || dto.definition !== undefined) {
      const definition = this.definitionFromDto(dto);
      automation.name = definition.metadata.name;
      automation.description = definition.metadata.description ?? null;
      automation.definitionJson = JSON.stringify(definition);
    }

    return this.mapper.automation(await this.automations.save(automation));
  }

  async remove(ownerUserId: string, id: string) {
    const automation = await this.getEntity(ownerUserId, id);
    for (const trigger of await this.triggers.listByOwner(ownerUserId)) {
      if (trigger.automationId === automation.id) {
        this.triggerScheduler.unregister(trigger.id);
      }
    }
    await this.triggers.deleteByAutomation(ownerUserId, automation.id);
    await this.automations.remove(automation);
    return this.mapper.automation(automation);
  }

  validateYaml(yaml: string) {
    return this.definitions.validateYaml(yaml);
  }

  draftYaml(dto: DraftAutomationYamlDto): AutomationYamlDraftDto {
    const definition = this.aiAutomationDefinition({
      name: 'AI drafted automation',
      prompt: dto.prompt,
      providerId: dto.providerId,
      modelId: dto.modelId,
    });
    return {
      definition,
      yaml: this.definitions.toYaml(definition),
    };
  }

  async runAdHocAi(dto: RunAdHocAiAutomationDto) {
    await this.assertTargetApplication(
      dto.ownerUserId,
      dto.targetApplicationId,
    );
    const definition = this.aiAutomationDefinition({
      name: 'Ad-hoc AI automation',
      prompt: dto.prompt,
      providerId: dto.providerId,
      modelId: dto.modelId,
      allowedTools: dto.allowedTools,
      maxToolCalls: dto.maxToolCalls,
      timeoutMs: dto.timeoutMs,
    });
    const run = await this.runner.enqueueEphemeral(
      dto.ownerUserId,
      definition,
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
    return this.mapper.run(run);
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
    return this.mapper.run(run);
  }

  async listRuns(ownerUserId: string, automationId: string, limit?: number) {
    await this.getEntity(ownerUserId, automationId);
    return (
      await this.runs.listForAutomation(ownerUserId, automationId, limit)
    ).map((run) => this.mapper.run(run));
  }

  async listActiveRuns(ownerUserId: string) {
    return (await this.runs.listActive(ownerUserId)).map((run) =>
      this.mapper.run(run),
    );
  }

  async getRun(ownerUserId: string, id: string) {
    const run = await this.runs.findByOwnerAndId(ownerUserId, id);
    if (!run) {
      throw new NotFoundException(`Automation run "${id}" was not found.`);
    }
    return this.mapper.run(run);
  }

  async cancelRun(ownerUserId: string, id: string) {
    return this.mapper.run(await this.runner.cancel(ownerUserId, id));
  }

  async listRunEvents(
    ownerUserId: string,
    runId: string,
    after?: number,
  ): Promise<AutomationRunEventDto[]> {
    await this.getRun(ownerUserId, runId);
    return this.events.list(ownerUserId, runId, after);
  }

  async createRunEventStreamToken(
    ownerUserId: string,
    runId: string,
  ): Promise<AutomationRunEventStreamTokenDto> {
    await this.getRun(ownerUserId, runId);
    return this.eventStream.createSubscribeToken(ownerUserId, runId);
  }

  async listTriggers(ownerUserId: string) {
    return (await this.triggers.listByOwner(ownerUserId)).map((trigger) =>
      this.mapper.trigger(trigger),
    );
  }

  async listTriggersGrid(
    query: ListAutomationTriggersGridQueryDto,
  ): Promise<AutomationTriggersGridPageDto> {
    const ownerUserId = query.ownerUserId.trim();
    const page = Math.max(Math.trunc(query.page ?? 1), 1);
    const pageSize = Math.min(
      Math.max(Math.trunc(query.pageSize ?? 20), 1),
      100,
    );
    const [triggers, automations] = await Promise.all([
      this.triggers.listByOwner(ownerUserId),
      this.automations.listByOwner(ownerUserId),
    ]);
    const automationNamesById = new Map(
      automations.map((automation) => [automation.id, automation.name]),
    );
    const triggerDtos = triggers.map((trigger) => this.mapper.trigger(trigger));
    const facets = automationTriggerGridFacets(triggerDtos);

    const lastRun = query.lastRun ?? 'all';
    const filtered = filterAutomationTriggerGridItems({
      automationNamesById,
      lastRun,
      query,
      triggers: triggerDtos,
    });

    const sorted = sortAutomationTriggerGridItems(filtered, query.sort);
    const offset = (page - 1) * pageSize;
    return {
      items: sorted.slice(offset, offset + pageSize),
      total: sorted.length,
      page,
      pageSize,
      facets,
    };
  }

  async getTrigger(ownerUserId: string, id: string) {
    return this.mapper.trigger(await this.getTriggerEntity(ownerUserId, id));
  }

  async createTrigger(dto: CreateAutomationTriggerDto) {
    const ownerUserId = dto.ownerUserId.trim();
    await this.getEntity(ownerUserId, dto.automationId);
    await this.assertTargetApplication(ownerUserId, dto.targetApplicationId);
    const triggerConfig = this.triggerScheduler.normalizeConfig(
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
      tagsJson: stringifyTags(dto.tags),
      triggerType: dto.triggerType,
      triggerConfigJson: JSON.stringify(triggerConfig),
      lastStatus: AutomationLastStatus.NeverRun,
      lastRunAt: null,
      lastError: null,
      nextRunAt:
        dto.enabled === false
          ? null
          : this.triggerScheduler.nextRunForTrigger(
              dto.triggerType,
              triggerConfig,
            ),
    });
    const saved = await this.triggers.save(trigger);
    this.registerTrigger(saved);
    return this.mapper.trigger(saved);
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
    if (dto.tags !== undefined) {
      trigger.tagsJson = stringifyTags(dto.tags);
    }
    if (dto.triggerType !== undefined) {
      trigger.triggerType = dto.triggerType;
    }
    if (dto.triggerConfig !== undefined || dto.triggerType !== undefined) {
      const triggerConfig = this.triggerScheduler.normalizeConfig(
        trigger.triggerType,
        dto.triggerConfig ?? this.mapper.triggerConfig(trigger),
      );
      trigger.triggerConfigJson = JSON.stringify(triggerConfig);
    }
    trigger.nextRunAt = trigger.enabled
      ? this.triggerScheduler.nextRunForTrigger(
          trigger.triggerType,
          this.mapper.triggerConfig(trigger),
        )
      : null;
    const saved = await this.triggers.save(trigger);
    this.registerTrigger(saved);
    return this.mapper.trigger(saved);
  }

  async removeTrigger(ownerUserId: string, id: string) {
    const trigger = await this.getTriggerEntity(ownerUserId, id);
    this.triggerScheduler.unregister(trigger.id);
    await this.triggers.remove(trigger);
    return this.mapper.trigger(trigger);
  }

  async runTrigger(ownerUserId: string, id: string) {
    const trigger = await this.getTriggerEntity(ownerUserId, id);
    const automation = await this.getEntity(ownerUserId, trigger.automationId);
    const run = await this.enqueueTriggerRun(trigger, automation);
    return this.mapper.run(run);
  }

  private async enqueueTriggerRun(
    trigger: AutomationTrigger,
    automation: Automation,
  ) {
    const config = this.triggerScheduler.parseScheduleConfig(trigger);
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
      ? this.triggerScheduler.nextRunForTrigger(trigger.triggerType, config)
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

  private registerTrigger(trigger: AutomationTrigger) {
    this.triggerScheduler.register(trigger, () => {
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
      trigger.nextRunAt = this.triggerScheduler.nextRunForTrigger(
        trigger.triggerType,
        this.triggerScheduler.parseScheduleConfig(trigger),
      );
      await this.triggers.save(trigger);
    }
  }

  private toRunnerStartPolicy(policy: AutomationStartPolicy) {
    return policy === AutomationStartPolicy.StartIfNeeded
      ? AutomationRunStartPolicy.StartIfNeeded
      : AutomationRunStartPolicy.RequireRunning;
  }

  private aiAutomationDefinition({
    name,
    prompt,
    providerId,
    modelId,
    allowedTools,
    maxToolCalls = 20,
    timeoutMs = 120_000,
  }: {
    name: string;
    prompt: string;
    providerId?: string;
    modelId?: string;
    allowedTools?: string[];
    maxToolCalls?: number;
    timeoutMs?: number;
  }): AutomationDefinition {
    return this.definitions.normalize({
      apiVersion: 'rebroid.io/automation/v1',
      kind: 'AndroidAutomation',
      metadata: {
        name,
        description: prompt.trim().slice(0, 240),
        tags: [{ name: 'ai', color: '#0ea5e9' }],
      },
      spec: {
        steps: [
          {
            id: 'ai-run',
            uses: 'ai.run',
            with: {
              prompt,
              ...(providerId ? { providerId } : {}),
              ...(modelId ? { modelId } : {}),
              ...(allowedTools ? { allowedTools } : {}),
              maxToolCalls,
              timeoutMs,
              requireFinalAnswer: true,
            },
          },
        ],
      },
    });
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
}
