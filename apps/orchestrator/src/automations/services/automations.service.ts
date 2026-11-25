import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { AutomationAiDefinitionFactory } from '../ai/automation-ai-definition.factory';
import { AutomationAiSuggestionsService } from '../ai/automation-ai-suggestions.service';
import { AutomationAiYamlDraftService } from '../ai/automation-ai-yaml-draft.service';
import { AutomationCommandDto } from '../dto/automation-command.dto';
import type {
  ApplicationWorkflowRunDto,
  ApplicationWorkflowRunPageDto,
  ListApplicationWorkflowRunsDto,
} from '../dto/application-workflow-history.dto';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationDefinitionService } from '../definition/automation-definition.service';
import {
  CreateAutomationDto,
  DraftAutomationYamlDto,
  UpdateAutomationDto,
} from '../dto/automation.dto';
import {
  RunAdHocAiAutomationDto,
  SuggestAdHocAiPromptsDto,
} from '../dto/automation-ai-run.dto';
import {
  AutomationRunEventDto,
  AutomationRunEventPageDto,
  AutomationRunEventStreamTokenDto,
} from '../dto/automation-run-event.dto';
import type {
  ActiveAutomationRunDto,
  RunAutomationDto,
} from '../dto/automation-run.dto';
import {
  CreateAutomationTriggerDto,
  UpdateAutomationTriggerDto,
} from '../dto/automation-trigger.dto';
import {
  AutomationRun,
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import { AutomationStartPolicy } from '../entities/automation-trigger.entity';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationsRepository } from '../persistence/automations.repository';
import { AutomationRunnerService } from '../runner/automation-runner.service';
import { toAutomationRunStartPolicy } from '../runner/automation-runner-policy';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationRunEventStreamService } from '../events/automation-run-event-stream.service';
import { AutomationTargetApplicationService } from './automation-target-application.service';
import { AutomationTriggersService } from './automation-triggers.service';
import { AutomationsDtoMapper } from './automations-dto-mapper.service';
import { AutomationsQueryService } from './automations-query.service';

@Injectable()
export class AutomationsService {
  constructor(
    private readonly automations: AutomationsRepository,
    private readonly runs: AutomationRunsRepository,
    private readonly definitions: AutomationDefinitionService,
    private readonly registry: AutomationCommandRegistryService,
    private readonly runner: AutomationRunnerService,
    private readonly events: AutomationRunEventBus,
    private readonly eventStream: AutomationRunEventStreamService,
    private readonly mapper: AutomationsDtoMapper,
    private readonly queries: AutomationsQueryService,
    private readonly targetApplications: AutomationTargetApplicationService,
    private readonly aiDefinitions: AutomationAiDefinitionFactory,
    private readonly aiSuggestions: AutomationAiSuggestionsService,
    private readonly aiYamlDrafts: AutomationAiYamlDraftService,
    private readonly automationTriggers: AutomationTriggersService,
    private readonly features: FeatureFlagsService,
  ) {}

  listCommands(): AutomationCommandDto[] {
    return this.registry.listCommands();
  }

  async list(ownerUserId: string) {
    return this.queries.list(ownerUserId);
  }

  async listGrid(query: Parameters<AutomationsQueryService['listGrid']>[0]) {
    return this.queries.listGrid(query);
  }

  listOptions(ownerUserId: string) {
    return this.queries.listOptions(ownerUserId);
  }

  listRunnableOptions(ownerUserId: string) {
    return this.queries.listRunnableOptions(ownerUserId);
  }

  async get(ownerUserId: string, id: string) {
    return this.queries.get(ownerUserId, id);
  }

  async create(dto: CreateAutomationDto) {
    const definition = this.definitionFromDto(dto);
    const automation = this.automations.create({
      ownerUserId: dto.ownerUserId.trim(),
      name: definition.metadata.name,
      description: definition.metadata.description ?? null,
      definitionJson: JSON.stringify(definition),
    });
    return this.mapper.automation(await this.automations.save(automation));
  }

  async update(ownerUserId: string, id: string, dto: UpdateAutomationDto) {
    const automation = await this.queries.getEntity(ownerUserId, id);
    if (dto.yaml !== undefined || dto.definition !== undefined) {
      const definition = this.definitionFromDto(dto);
      automation.name = definition.metadata.name;
      automation.description = definition.metadata.description ?? null;
      automation.definitionJson = JSON.stringify(definition);
    }

    await this.automations.save(automation);
    return this.queries.get(ownerUserId, id);
  }

  async remove(ownerUserId: string, id: string) {
    const automation = await this.queries.getEntity(ownerUserId, id);
    const dto = await this.queries.get(ownerUserId, id);
    await this.automationTriggers.removeByAutomation(
      ownerUserId,
      automation.id,
    );
    await this.automations.remove(automation);
    return dto;
  }

  validateYaml(yaml: string) {
    return this.definitions.validateYaml(yaml);
  }

  draftYamlEvents(dto: DraftAutomationYamlDto, abortSignal?: AbortSignal) {
    return this.aiYamlDrafts.draftEvents(dto, { abortSignal });
  }

  async runAdHocAi(dto: RunAdHocAiAutomationDto) {
    const device = await this.targetApplications.assertOwnerAccess(
      dto.ownerUserId,
      dto.targetDeviceId,
    );
    if (
      device?.kind === 'external' &&
      (!dto.attachmentId || dto.attachmentId !== device.attachmentId)
    ) {
      throw new ConflictException(
        'Open the verified attachment before sending a device-agent prompt.',
      );
    }
    const definition = this.aiDefinitions.create({
      name: 'Ad-hoc AI automation',
      prompt: dto.prompt,
      conversation: dto.conversation,
      providerId: dto.providerId,
      modelId: dto.modelId,
      visionProviderId: dto.visionProviderId,
      visionModelId: dto.visionModelId,
      clientMessageId: dto.clientMessageId,
      capabilities: dto.capabilities,
      agentMode: dto.agentMode,
      rawShellPolicy: dto.rawShellPolicy,
      maxActions: dto.maxActions,
      timeoutMs: dto.timeoutMs,
    });
    const run = await this.runner.enqueueEphemeral(
      dto.ownerUserId,
      definition,
      AutomationRunTrigger.Manual,
      {
        targetDeviceId: dto.targetDeviceId,
        targetAttachmentId: dto.attachmentId,
        targetProfileMode: dto.profileMode,
        targetProfileName: dto.profileName?.trim() || null,
        currentProfileOnly:
          dto.startPolicy !== AutomationStartPolicy.StartIfNeeded,
        startPolicy: toAutomationRunStartPolicy(
          dto.startPolicy ?? AutomationStartPolicy.RequireRunning,
        ),
      },
      { prompt: dto.prompt.trim(), clientMessageId: dto.clientMessageId },
    );
    return this.mapper.run(run);
  }

  async suggestAdHocAiPrompts(dto: SuggestAdHocAiPromptsDto) {
    const device = await this.targetApplications.assertOwnerAccess(
      dto.ownerUserId,
      dto.targetDeviceId,
    );
    const external = device?.kind === 'external';
    if (external) this.features.assertEnabled('feature.external-devices');
    if (
      external &&
      (!dto.attachmentId || dto.attachmentId !== device.attachmentId)
    ) {
      throw new ConflictException(
        'Open the verified attachment before requesting device-agent suggestions.',
      );
    }
    return this.aiSuggestions.suggest(dto, external);
  }

  async listAdHocAiRuns(
    ownerUserId: string,
    targetDeviceId: string,
    limit?: number,
  ) {
    await this.targetApplications.assertOwnerAccess(
      ownerUserId,
      targetDeviceId,
    );
    return (
      await this.runs.listAdHocAiForTarget(
        ownerUserId.trim(),
        targetDeviceId,
        limit,
      )
    ).map((run) => this.mapper.run(run));
  }

  async listAdHocAiRunHistory(
    ownerUserId: string,
    targetDeviceId: string,
    limit?: number,
    attachmentId?: string,
  ) {
    const history = await this.listAdHocAiRuns(
      ownerUserId,
      targetDeviceId,
      limit,
    );
    const runs = attachmentId
      ? history.filter((run) => run.targetAttachmentId === attachmentId)
      : history;
    const events = await this.events.listConversationEvents(
      ownerUserId.trim(),
      runs.map((run) => run.id),
    );
    const byRun = new Map<string, AutomationRunEventDto[]>();
    for (const event of events) {
      const group = byRun.get(event.runId);
      if (group) group.push(event);
      else byRun.set(event.runId, [event]);
    }
    return runs.map((run) => ({ run, events: byRun.get(run.id) ?? [] }));
  }

  async clearAdHocAiRuns(
    ownerUserId: string,
    targetDeviceId: string,
    attachmentId?: string,
  ) {
    const device = await this.targetApplications.assertOwnerAccess(
      ownerUserId,
      targetDeviceId,
    );
    if (device?.kind === 'external' && !attachmentId)
      throw new ConflictException(
        'Select a device attachment to clear its conversation.',
      );
    const history = await this.runs.listAllAdHocAiForTarget(
      ownerUserId.trim(),
      targetDeviceId,
    );
    const runs = attachmentId
      ? history.filter((run) => run.targetAttachmentId === attachmentId)
      : history;
    for (const run of runs) {
      if (
        run.status === AutomationRunStatus.Queued ||
        run.status === AutomationRunStatus.Running
      ) {
        await this.runner.cancel(ownerUserId, run.id);
      }
    }
    const runIds = runs.map((run) => run.id);
    await this.events.deleteForRuns(ownerUserId, runIds);
    await this.runs.deleteByIds(ownerUserId, runIds);
    return { cleared: runIds.length };
  }

  async run(ownerUserId: string, id: string, dto: RunAutomationDto) {
    const automation = await this.queries.getEntity(ownerUserId, id);
    await this.targetApplications.assertOwnerAccess(
      ownerUserId,
      dto.targetDeviceId,
    );
    const run = await this.runner.enqueue(
      automation,
      AutomationRunTrigger.Manual,
      {
        targetDeviceId: dto.targetDeviceId,
        targetAttachmentId: dto.attachmentId,
        targetProfileMode: dto.profileMode,
        targetProfileName: dto.profileName?.trim() || null,
        startPolicy: toAutomationRunStartPolicy(
          dto.startPolicy ?? AutomationStartPolicy.RequireRunning,
        ),
      },
    );
    return this.mapper.run(run);
  }

  async listRuns(ownerUserId: string, automationId: string, limit?: number) {
    await this.queries.getEntity(ownerUserId, automationId);
    return (
      await this.runs.listForAutomation(ownerUserId, automationId, limit)
    ).map((run) => this.mapper.run(run));
  }

  async listRunHistory(
    ownerUserId: string,
    automationId: string,
    limit?: number,
  ) {
    await this.queries.getEntity(ownerUserId, automationId);
    const rows = await this.runs.listHistoryForAutomation(
      ownerUserId,
      automationId,
      limit,
    );
    return rows.map(({ run, ...counts }) =>
      this.mapper.runHistoryRow(run, counts),
    );
  }

  async listActiveRuns(ownerUserId: string): Promise<ActiveAutomationRunDto[]> {
    const rows = await this.runs.listActive(ownerUserId);
    const showNames = this.features.isEnabled('feature.workflows');
    return rows.flatMap(({ run, workflowName }) => {
      const {
        id,
        automationId,
        targetDeviceId,
        targetKind,
        status,
        createdAt,
      } = run;
      if (
        status !== AutomationRunStatus.Queued &&
        status !== AutomationRunStatus.Running
      )
        return [];
      return [
        {
          id,
          automationId,
          targetDeviceId,
          ...(targetKind === 'external' && { targetKind }),
          status,
          createdAt: createdAt.toISOString(),
          workflowName: showNames ? workflowName : null,
        },
      ];
    });
  }

  async listApplicationWorkflowRuns({
    ownerUserId,
    targetDeviceId,
    page = 0,
    pageSize = 25,
    q = '',
  }: ListApplicationWorkflowRunsDto): Promise<ApplicationWorkflowRunPageDto> {
    await this.targetApplications.assertOwnerAccess(
      ownerUserId,
      targetDeviceId,
    );
    const { items, total } = await this.runs.listApplicationWorkflows(
      ownerUserId,
      targetDeviceId,
      page,
      pageSize,
      q.trim(),
    );
    return {
      items: items.map(({ run, automationName }) => ({
        id: run.id,
        automationId: run.automationId,
        automationName,
        status: run.status,
        trigger: run.trigger,
        createdAt: run.createdAt.toISOString(),
        startedAt: run.startedAt?.toISOString() ?? null,
        completedAt: run.completedAt?.toISOString() ?? null,
      })),
      total,
      pageSize,
    };
  }

  async getApplicationWorkflowRun(
    ownerUserId: string,
    targetDeviceId: string,
    runId: string,
  ): Promise<ApplicationWorkflowRunDto> {
    await this.targetApplications.assertOwnerAccess(
      ownerUserId,
      targetDeviceId,
    );
    const record = await this.runs.findApplicationWorkflow(
      ownerUserId,
      targetDeviceId,
      runId,
    );
    if (!record)
      throw new NotFoundException(
        'Workflow run was not found for this application.',
      );
    return {
      ...(await this.runDetails(record.run)),
      automationName: record.automationName,
    };
  }

  async getRun(ownerUserId: string, id: string) {
    return this.runDetails(await this.getOwnedRun(ownerUserId, id));
  }

  private async runDetails(run: AutomationRun) {
    const result = this.mapper.run(run);
    if (run.status !== AutomationRunStatus.Failed) return result;
    const failure = await this.events.findFailureDetails(
      run.ownerUserId,
      run.id,
    );
    return { ...result, ...failure };
  }

  private async getOwnedRun(ownerUserId: string, id: string) {
    const run = await this.runs.findByOwnerAndId(ownerUserId, id);
    if (!run) {
      throw new NotFoundException(`Automation run "${id}" was not found.`);
    }
    return run;
  }

  async cancelRun(ownerUserId: string, id: string) {
    const canceled = await this.runner.cancel(ownerUserId, id);
    const run = await this.runs.findByOwnerAndId(ownerUserId, id);
    return this.mapper.run(run ?? canceled);
  }

  private async assertOwnedRun(ownerUserId: string, id: string) {
    if (!(await this.runs.existsForOwner(ownerUserId, id))) {
      throw new NotFoundException(`Automation run "${id}" was not found.`);
    }
  }

  async listRunConversationEvents(
    ownerUserId: string,
    runId: string,
  ): Promise<AutomationRunEventDto[]> {
    await this.assertOwnedRun(ownerUserId, runId);
    return this.events.listConversationEvents(ownerUserId, [runId]);
  }

  async listRunEventPage(
    ownerUserId: string,
    runId: string,
    after: number,
  ): Promise<AutomationRunEventPageDto> {
    await this.assertOwnedRun(ownerUserId, runId);
    return this.events.listPage(ownerUserId, runId, after);
  }

  async createRunEventStreamToken(
    ownerUserId: string,
    runId: string,
  ): Promise<AutomationRunEventStreamTokenDto> {
    await this.assertOwnedRun(ownerUserId, runId);
    return this.eventStream.createSubscribeToken(ownerUserId, runId);
  }

  async listTriggers(ownerUserId: string) {
    return this.automationTriggers.list(ownerUserId);
  }

  async listTriggersGrid(
    query: Parameters<AutomationTriggersService['listGrid']>[0],
  ) {
    return this.automationTriggers.listGrid(query);
  }

  async getTrigger(ownerUserId: string, id: string) {
    return this.automationTriggers.get(ownerUserId, id);
  }

  async createTrigger(dto: CreateAutomationTriggerDto) {
    return this.automationTriggers.create(dto);
  }

  async updateTrigger(
    ownerUserId: string,
    id: string,
    dto: UpdateAutomationTriggerDto,
  ) {
    return this.automationTriggers.update(ownerUserId, id, dto);
  }

  async removeTrigger(ownerUserId: string, id: string) {
    return this.automationTriggers.remove(ownerUserId, id);
  }

  async runTrigger(ownerUserId: string, id: string) {
    return this.automationTriggers.run(ownerUserId, id);
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
}
