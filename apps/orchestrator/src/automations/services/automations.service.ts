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
  AutomationsGridPageDto,
  AutomationRunDto,
  AutomationTriggerDto,
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
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationRunEventStreamService } from '../events/automation-run-event-stream.service';
import {
  normalizeAutomationTags,
  parseAutomationTagsJson,
} from '../tags/automation-tags';

const toIso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;

const stringifyTags = (value: unknown) =>
  JSON.stringify(normalizeAutomationTags(value, 'tags') ?? []);

const tagNames = (value: { tags: { name: string }[] }) =>
  value.tags.map((tag) => tag.name);

const automationGridSortFields = new Set([
  'name',
  'lastRunAt',
  'lastStatus',
  'createdAt',
  'updatedAt',
]);

const automationTriggerGridSortFields = new Set([
  'name',
  'enabled',
  'nextRunAt',
  'lastRunAt',
  'lastStatus',
  'updatedAt',
]);

const compareNullableDates = (left: string | null, right: string | null) => {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return new Date(left).getTime() - new Date(right).getTime();
};

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
    private readonly events: AutomationRunEventBus,
    private readonly eventStream: AutomationRunEventStreamService,
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

    const facets = {
      tags: [
        ...new Set(
          automations.flatMap((automation) => tagNames(this.toDto(automation))),
        ),
      ].sort((left, right) => left.localeCompare(right)),
      targetApplicationIds: [
        ...new Set(triggers.map((trigger) => trigger.targetApplicationId)),
      ].sort((left, right) => left.localeCompare(right)),
    };

    const search = query.q?.trim().toLowerCase();
    const tag = query.tag?.trim();
    const lastRun = query.lastRun ?? 'all';
    const filtered = automations
      .map((automation) => this.toDto(automation))
      .filter((automation) => {
        const targetApplicationIds =
          targetApplicationIdsByAutomation.get(automation.id) ??
          new Set<string>();
        return (
          (!search ||
            [
              automation.name,
              automation.description,
              automation.lastStatus,
              ...tagNames(automation),
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(search)) &&
          (!tag || tagNames(automation).includes(tag)) &&
          (!query.status || automation.lastStatus === query.status) &&
          (!query.targetApplicationId ||
            targetApplicationIds.has(query.targetApplicationId)) &&
          this.matchesAutomationLastRun(automation, lastRun)
        );
      });

    const sorted = this.sortAutomationGridItems(filtered, query.sort);
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
    const automation = await this.automations.save(
      this.automations.create({
        ownerUserId: dto.ownerUserId.trim(),
        name: definition.metadata.name,
        description: definition.metadata.description ?? null,
        definitionJson: JSON.stringify(definition),
        lastStatus: AutomationLastStatus.Running,
        lastRunAt: new Date(),
        lastError: null,
      }),
    );
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
    return this.toRunDto(run);
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

  async cancelRun(ownerUserId: string, id: string) {
    return this.toRunDto(await this.runner.cancel(ownerUserId, id));
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
      this.toTriggerDto(trigger),
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
    const automationById = new Map(
      automations.map((automation) => [automation.id, automation]),
    );
    const triggerDtos = triggers.map((trigger) => this.toTriggerDto(trigger));
    const facets = {
      tags: [
        ...new Set(triggerDtos.flatMap((trigger) => tagNames(trigger))),
      ].sort((left, right) => left.localeCompare(right)),
      targetApplicationIds: [
        ...new Set(triggerDtos.map((trigger) => trigger.targetApplicationId)),
      ].sort((left, right) => left.localeCompare(right)),
    };

    const search = query.q?.trim().toLowerCase();
    const tag = query.tag?.trim();
    const lastRun = query.lastRun ?? 'all';
    const filtered = triggerDtos.filter((trigger) => {
      const automation = automationById.get(trigger.automationId);
      return (
        (!search ||
          [
            trigger.name,
            trigger.targetApplicationId,
            trigger.profileName,
            trigger.lastStatus,
            automation?.name,
            ...tagNames(trigger),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(search)) &&
        (!tag || tagNames(trigger).includes(tag)) &&
        (!query.targetApplicationId ||
          trigger.targetApplicationId === query.targetApplicationId) &&
        (!query.enabled || String(trigger.enabled) === query.enabled) &&
        (!query.status || trigger.lastStatus === query.status) &&
        this.matchesAutomationTriggerLastRun(trigger, lastRun)
      );
    });

    const sorted = this.sortAutomationTriggerGridItems(filtered, query.sort);
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
      tagsJson: stringifyTags(dto.tags),
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
    if (dto.tags !== undefined) {
      trigger.tagsJson = stringifyTags(dto.tags);
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

  private matchesAutomationLastRun(
    automation: AutomationDto,
    filter: ListAutomationsGridQueryDto['lastRun'],
  ) {
    if (!filter || filter === 'all') return true;
    if (filter === 'never') return automation.lastRunAt === null;
    if (!automation.lastRunAt) return false;
    const days = filter === '7d' ? 7 : filter === '30d' ? 30 : 90;
    return (
      new Date(automation.lastRunAt).getTime() >=
      Date.now() - days * 24 * 60 * 60 * 1000
    );
  }

  private matchesAutomationTriggerLastRun(
    trigger: AutomationTriggerDto,
    filter: ListAutomationTriggersGridQueryDto['lastRun'],
  ) {
    if (!filter || filter === 'all') return true;
    if (filter === 'never') return trigger.lastRunAt === null;
    if (!trigger.lastRunAt) return false;
    const days = filter === '7d' ? 7 : filter === '30d' ? 30 : 90;
    return (
      new Date(trigger.lastRunAt).getTime() >=
      Date.now() - days * 24 * 60 * 60 * 1000
    );
  }

  private sortAutomationGridItems(items: AutomationDto[], sort?: string) {
    const sorting = (sort || 'updatedAt:desc')
      .split(',')
      .map((part) => {
        const [id, direction] = part.split(':');
        if (!id || !automationGridSortFields.has(id)) return null;
        return { id, desc: direction !== 'asc' };
      })
      .filter((item): item is { id: string; desc: boolean } => Boolean(item))
      .slice(0, 3);

    return [...items].sort((left, right) => {
      for (const sortItem of sorting) {
        const multiplier = sortItem.desc ? -1 : 1;
        let result = 0;
        if (sortItem.id === 'name') {
          result = left.name.localeCompare(right.name);
        } else if (sortItem.id === 'lastStatus') {
          result = left.lastStatus.localeCompare(right.lastStatus);
        } else if (sortItem.id === 'lastRunAt') {
          result = compareNullableDates(left.lastRunAt, right.lastRunAt);
        } else if (sortItem.id === 'createdAt') {
          result =
            new Date(left.createdAt).getTime() -
            new Date(right.createdAt).getTime();
        } else if (sortItem.id === 'updatedAt') {
          result =
            new Date(left.updatedAt).getTime() -
            new Date(right.updatedAt).getTime();
        }

        if (result !== 0) return result * multiplier;
      }
      return left.id.localeCompare(right.id);
    });
  }

  private sortAutomationTriggerGridItems(
    items: AutomationTriggerDto[],
    sort?: string,
  ) {
    const sorting = (sort || 'updatedAt:desc')
      .split(',')
      .map((part) => {
        const [id, direction] = part.split(':');
        if (!id || !automationTriggerGridSortFields.has(id)) return null;
        return { id, desc: direction !== 'asc' };
      })
      .filter((item): item is { id: string; desc: boolean } => Boolean(item))
      .slice(0, 3);

    return [...items].sort((left, right) => {
      for (const sortItem of sorting) {
        const multiplier = sortItem.desc ? -1 : 1;
        let result = 0;
        if (sortItem.id === 'name') {
          result = left.name.localeCompare(right.name);
        } else if (sortItem.id === 'enabled') {
          result = Number(left.enabled) - Number(right.enabled);
        } else if (sortItem.id === 'lastStatus') {
          result = left.lastStatus.localeCompare(right.lastStatus);
        } else if (sortItem.id === 'lastRunAt') {
          result = compareNullableDates(left.lastRunAt, right.lastRunAt);
        } else if (sortItem.id === 'nextRunAt') {
          result = compareNullableDates(left.nextRunAt, right.nextRunAt);
        } else if (sortItem.id === 'updatedAt') {
          result =
            new Date(left.updatedAt).getTime() -
            new Date(right.updatedAt).getTime();
        }

        if (result !== 0) return result * multiplier;
      }
      return left.id.localeCompare(right.id);
    });
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
      tags: definition.metadata.tags ?? [],
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
      tags: parseAutomationTagsJson(trigger.tagsJson),
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
