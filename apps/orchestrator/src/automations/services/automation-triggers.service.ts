import { FeatureDisabledException } from '../../feature-flags/feature-flags.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { AutomationDefinition } from '@rebroid/automation-core/definition';
import { externalDefinitionIssue } from '@rebroid/automation-core/device-capabilities';
import {
  AutomationTriggersGridPageDto,
  CreateAutomationTriggerDto,
  ListAutomationTriggersGridQueryDto,
  UpdateAutomationTriggerDto,
} from '../dto/automation-trigger.dto';
import { Automation } from '../entities/automation.entity';
import { AutomationRunTrigger } from '../entities/automation-run.entity';
import { AutomationTrigger } from '../entities/automation-trigger.entity';
import type { CronTick } from '../../common/cron-registration';
import { getErrorMessage } from '../../common/error-message';
import { AutomationsRepository } from '../persistence/automations.repository';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationTriggersRepository } from '../persistence/automation-triggers.repository';
import { AutomationRunnerService } from '../runner/automation-runner.service';
import { toAutomationRunStartPolicy } from '../runner/automation-runner-policy';
import { normalizeAutomationTags } from '../tags/automation-tags';
import { AutomationTargetApplicationService } from './automation-target-application.service';
import {
  AutomationTriggerSchedulerService,
  type ScheduleTriggerConfig,
} from './automation-trigger-scheduler.service';
import { AutomationsDtoMapper } from './automations-dto-mapper.service';
import { buildAutomationTriggerGridPage } from './automations-grid-utils';
import { AutomationsQueryService } from './automations-query.service';

const stringifyTags = (value: unknown) =>
  JSON.stringify(normalizeAutomationTags(value, 'tags') ?? []);

@Injectable()
export class AutomationTriggersService implements OnModuleInit {
  private readonly logger = new Logger(AutomationTriggersService.name);

  constructor(
    private readonly automations: AutomationsRepository,
    private readonly triggers: AutomationTriggersRepository,
    private readonly runner: AutomationRunnerService,
    private readonly mapper: AutomationsDtoMapper,
    private readonly triggerScheduler: AutomationTriggerSchedulerService,
    private readonly queries: AutomationsQueryService,
    private readonly targetApplications: AutomationTargetApplicationService,
    private readonly runs: AutomationRunsRepository,
  ) {}

  async onModuleInit() {
    for (const trigger of await this.triggers.findAll()) {
      this.registerTrigger(trigger);
    }
  }

  async list(ownerUserId: string) {
    const [triggers, latestRuns] = await Promise.all([
      this.triggers.listByOwner(ownerUserId),
      this.runs.latestForTriggers(ownerUserId),
    ]);
    return triggers.map((trigger) =>
      this.mapper.trigger(trigger, latestRuns.get(trigger.id)),
    );
  }

  async listGrid(
    query: ListAutomationTriggersGridQueryDto,
  ): Promise<AutomationTriggersGridPageDto> {
    const ownerUserId = query.ownerUserId.trim();
    const [triggerDtos, automations] = await Promise.all([
      this.list(ownerUserId),
      query.q?.trim() ? this.automations.listNamesByOwner(ownerUserId) : [],
    ]);
    const automationNamesById = new Map(
      automations.map((automation) => [automation.id, automation.name]),
    );
    return buildAutomationTriggerGridPage(
      triggerDtos,
      query,
      automationNamesById,
    );
  }

  async get(ownerUserId: string, id: string) {
    const [trigger, latestRuns] = await Promise.all([
      this.getEntity(ownerUserId, id),
      this.runs.latestForTriggers(ownerUserId, id),
    ]);
    return this.mapper.trigger(trigger, latestRuns.get(id));
  }

  async create(dto: CreateAutomationTriggerDto) {
    const ownerUserId = dto.ownerUserId.trim();
    const workflow = await this.queries.getEntity(
      ownerUserId,
      dto.automationId,
    );
    const device = await this.targetApplications.assertOwnerAccess(
      ownerUserId,
      dto.targetDeviceId,
    );
    const triggerConfig = this.triggerScheduler.normalizeConfig(
      dto.triggerType,
      dto.triggerConfig,
    );
    if (device?.kind === 'external')
      this.assertExternalConfiguration(
        workflow,
        dto.profileMode,
        dto.profileName,
        triggerConfig,
      );
    const trigger = this.triggers.create({
      ownerUserId,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      automationId: dto.automationId,
      targetDeviceId: dto.targetDeviceId,
      profileMode: dto.profileMode ?? null,
      profileName: dto.profileName?.trim() || null,
      enabled: dto.enabled !== false,
      tagsJson: stringifyTags(dto.tags),
      triggerType: dto.triggerType,
      triggerConfigJson: JSON.stringify(triggerConfig),
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

  async update(
    ownerUserId: string,
    id: string,
    dto: UpdateAutomationTriggerDto,
  ) {
    const existing = await this.getEntity(ownerUserId, id);
    const device = await this.targetApplications.assertOwnerAccess(
      ownerUserId,
      dto.targetDeviceId ?? existing.targetDeviceId,
    );
    const workflow =
      device?.kind === 'external' || dto.automationId !== undefined
        ? await this.queries.getEntity(
            ownerUserId,
            dto.automationId ?? existing.automationId,
          )
        : undefined;
    const saved = await this.triggers.updateConfiguration(
      ownerUserId,
      id,
      (current) => {
        if (
          current.targetDeviceId !== existing.targetDeviceId ||
          current.automationId !== existing.automationId
        ) {
          throw new ConflictException(
            'The workflow trigger target changed. Refresh and try again.',
          );
        }
        const triggerType = dto.triggerType ?? current.triggerType;
        const currentConfig = this.mapper.triggerConfig(current);
        const updatesConfig =
          dto.triggerConfig !== undefined || dto.triggerType !== undefined;
        const triggerConfig = updatesConfig
          ? this.triggerScheduler.normalizeConfig(triggerType, {
              ...currentConfig,
              ...dto.triggerConfig,
            })
          : currentConfig;
        const enabled = dto.enabled ?? current.enabled;
        if (device?.kind === 'external' && workflow) {
          this.assertExternalConfiguration(
            workflow,
            dto.profileMode === undefined
              ? current.profileMode
              : dto.profileMode,
            dto.profileName === undefined
              ? current.profileName
              : dto.profileName,
            triggerConfig,
          );
        }
        return {
          name: dto.name?.trim(),
          description:
            dto.description === undefined
              ? undefined
              : dto.description?.trim() || null,
          automationId: dto.automationId,
          targetDeviceId: dto.targetDeviceId,
          profileMode: dto.profileMode,
          profileName:
            dto.profileName === undefined
              ? undefined
              : dto.profileName?.trim() || null,
          enabled: dto.enabled,
          tagsJson:
            dto.tags === undefined ? undefined : stringifyTags(dto.tags),
          triggerType: dto.triggerType,
          triggerConfigJson: updatesConfig
            ? JSON.stringify(triggerConfig)
            : undefined,
          nextRunAt: enabled
            ? this.triggerScheduler.nextRunForTrigger(
                triggerType,
                triggerConfig,
              )
            : null,
        };
      },
    );
    if (!saved)
      throw new NotFoundException(`Automation trigger "${id}" was not found.`);
    this.registerTrigger(saved);
    const latestRuns = await this.runs.latestForTriggers(ownerUserId, id);
    return this.mapper.trigger(saved, latestRuns.get(id));
  }

  private assertExternalConfiguration(
    workflow: Automation,
    profileMode: string | null | undefined,
    profileName: string | null | undefined,
    config: ScheduleTriggerConfig | Record<string, unknown>,
  ) {
    if (profileMode || profileName || config.startPolicy === 'start-if-needed')
      throw new BadRequestException(
        'External triggers use a verified connection without startup or profiles.',
      );
    const issue = externalDefinitionIssue(
      JSON.parse(workflow.definitionJson) as AutomationDefinition,
    );
    if (issue) throw new BadRequestException(issue);
  }

  async remove(ownerUserId: string, id: string) {
    const trigger = await this.getEntity(ownerUserId, id);
    const latestRuns = await this.runs.latestForTriggers(ownerUserId, id);
    const removed = this.mapper.trigger(trigger, latestRuns.get(id));
    await this.triggers.remove(trigger);
    this.triggerScheduler.unregister(id);
    return removed;
  }

  async removeByAutomation(ownerUserId: string, automationId: string) {
    const removed = await this.triggers.deleteByAutomation(
      ownerUserId,
      automationId,
    );
    for (const id of removed) this.triggerScheduler.unregister(id);
  }

  async run(ownerUserId: string, id: string) {
    const trigger = await this.getEntity(ownerUserId, id);
    const automation = await this.queries.getEntity(
      ownerUserId,
      trigger.automationId,
    );
    const config = this.triggerScheduler.parseScheduleConfig(trigger);
    const run = await this.enqueueTriggerRun(trigger, automation, config);
    await this.recordSchedule(trigger, config);
    return this.mapper.run(run);
  }

  private enqueueTriggerRun(
    trigger: AutomationTrigger,
    automation: Automation,
    config: ScheduleTriggerConfig,
  ) {
    return this.runner.enqueue(automation, AutomationRunTrigger.Schedule, {
      automationTriggerId: trigger.id,
      targetDeviceId: trigger.targetDeviceId,
      targetProfileMode: trigger.profileMode,
      targetProfileName: trigger.profileName,
      startPolicy: toAutomationRunStartPolicy(config.startPolicy),
    });
  }

  private async recordSchedule(
    trigger: AutomationTrigger,
    config: ScheduleTriggerConfig,
    failure?: { at: Date; message: string },
  ) {
    try {
      await this.triggers.updateSchedule(
        trigger,
        trigger.enabled
          ? this.triggerScheduler.nextRunForTrigger(trigger.triggerType, {
              ...config,
            })
          : null,
        failure,
      );
    } catch (error) {
      this.logger.warn(
        `Could not update schedule for automation trigger ${trigger.id}: ${getErrorMessage(error)}`,
      );
    }
  }

  private async getEntity(ownerUserId: string, id: string) {
    const trigger = await this.triggers.findByOwnerAndId(ownerUserId, id);
    if (!trigger) {
      throw new NotFoundException(`Automation trigger "${id}" was not found.`);
    }
    return trigger;
  }

  private registerTrigger(trigger: AutomationTrigger) {
    this.triggerScheduler.register(trigger, (tick) => {
      void this.runScheduledTrigger(trigger.id, tick).catch(
        (error: unknown) => {
          this.logger.error(
            `Scheduled automation trigger ${trigger.id} failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
          );
        },
      );
    });
  }

  private async runScheduledTrigger(id: string, tick: CronTick) {
    if (!tick.isCurrent()) return;
    const scheduled = await this.triggers.findEnabledSchedule(id);
    if (!scheduled) {
      return;
    }
    const automation = await this.automations.findByOwnerAndId(
      scheduled.ownerUserId,
      scheduled.automationId,
    );
    if (!automation || !tick.isCurrent()) return;
    const trigger = await this.triggers.findEnabledSchedule(id);
    if (
      !trigger ||
      trigger.ownerUserId !== scheduled.ownerUserId ||
      trigger.automationId !== scheduled.automationId
    ) {
      return;
    }
    const config = this.triggerScheduler.parseScheduleConfig(trigger);
    if (!tick.isCurrent() || config.cronExpression !== tick.cronExpression)
      return;
    const attemptedAt = new Date();
    try {
      await this.enqueueTriggerRun(trigger, automation, config);
    } catch (error) {
      await this.recordSchedule(
        trigger,
        config,
        error instanceof FeatureDisabledException
          ? undefined
          : {
              at: attemptedAt,
              message: error instanceof Error ? error.message : String(error),
            },
      );
      return;
    }
    await this.recordSchedule(trigger, config);
  }
}
