import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationProfileMode } from '../../android-apps/application-profile-mode';
import { AutomationAiDefinitionFactory } from '../ai/automation-ai-definition.factory';
import { AutomationAiYamlDraftService } from '../ai/automation-ai-yaml-draft.service';
import { AutomationCommandDto } from '../dto/automation-command.dto';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationDefinitionService } from '../definition/automation-definition.service';
import {
  CreateAutomationDto,
  DraftAutomationYamlDto,
  UpdateAutomationDto,
} from '../dto/automation.dto';
import {
  AutomationRunEventDto,
  AutomationRunEventStreamTokenDto,
  RunAdHocAiAutomationDto,
  RunAutomationDto,
} from '../dto/automation-run.dto';
import {
  CreateAutomationTriggerDto,
  UpdateAutomationTriggerDto,
} from '../dto/automation-trigger.dto';
import { AutomationLastStatus } from '../entities/automation.entity';
import {
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
    private readonly aiYamlDrafts: AutomationAiYamlDraftService,
    private readonly automationTriggers: AutomationTriggersService,
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
      lastStatus: AutomationLastStatus.NeverRun,
      lastRunAt: null,
      lastError: null,
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

    return this.mapper.automation(await this.automations.save(automation));
  }

  async remove(ownerUserId: string, id: string) {
    const automation = await this.queries.getEntity(ownerUserId, id);
    await this.automationTriggers.removeByAutomation(
      ownerUserId,
      automation.id,
    );
    await this.automations.remove(automation);
    return this.mapper.automation(automation);
  }

  validateYaml(yaml: string) {
    return this.definitions.validateYaml(yaml);
  }

  draftYamlEvents(dto: DraftAutomationYamlDto, abortSignal?: AbortSignal) {
    return this.aiYamlDrafts.draftEvents(dto, { abortSignal });
  }

  async runAdHocAi(dto: RunAdHocAiAutomationDto) {
    await this.targetApplications.assertOwnerAccess(
      dto.ownerUserId,
      dto.targetApplicationId,
    );
    const definition = this.aiDefinitions.create({
      name: 'Ad-hoc AI automation',
      prompt: dto.prompt,
      conversation: dto.conversation,
      providerId: dto.providerId,
      modelId: dto.modelId,
      visionProviderId: dto.visionProviderId,
      visionModelId: dto.visionModelId,
      clientMessageId: dto.clientMessageId,
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
        startPolicy: toAutomationRunStartPolicy(
          dto.startPolicy ?? AutomationStartPolicy.RequireRunning,
        ),
      },
    );
    return this.mapper.run(run);
  }

  async listAdHocAiRuns(
    ownerUserId: string,
    targetApplicationId: string,
    limit?: number,
  ) {
    await this.targetApplications.assertOwnerAccess(
      ownerUserId,
      targetApplicationId,
    );
    return (
      await this.runs.listAdHocAiForTarget(
        ownerUserId.trim(),
        targetApplicationId,
        limit,
      )
    ).map((run) => this.mapper.run(run));
  }

  async clearAdHocAiRuns(ownerUserId: string, targetApplicationId: string) {
    await this.targetApplications.assertOwnerAccess(
      ownerUserId,
      targetApplicationId,
    );
    const runs = await this.runs.listAllAdHocAiForTarget(
      ownerUserId.trim(),
      targetApplicationId,
    );
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
      dto.targetApplicationId,
    );
    const run = await this.runner.enqueue(
      automation,
      AutomationRunTrigger.Manual,
      {
        targetApplicationId: dto.targetApplicationId,
        targetProfileMode: dto.profileMode ?? ApplicationProfileMode.Persistent,
        targetProfileName: dto.profileName ?? 'default',
        startPolicy: toAutomationRunStartPolicy(
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
    await this.queries.getEntity(ownerUserId, automationId);
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
