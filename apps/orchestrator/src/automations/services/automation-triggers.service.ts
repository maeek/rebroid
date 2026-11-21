import { FeatureDisabledException } from '../../feature-flags/feature-flags.service';
import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
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
import {
  automationTriggerGridFacets,
  filterAutomationTriggerGridItems,
  sortAutomationTriggerGridItems,
} from './automations-grid-utils';
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
    const page = Math.max(Math.trunc(query.page ?? 1), 1);
    const pageSize = Math.min(
      Math.max(Math.trunc(query.pageSize ?? 20), 1),
      100,
    );
    const [triggerDtos, automations] = await Promise.all([
      this.list(ownerUserId),
      query.q?.trim() ? this.automations.listNamesByOwner(ownerUserId) : [],
    ]);
    const automationNamesById = new Map(
      automations.map((automation) => [automation.id, automation.name]),
    );
    const facets = automationTriggerGridFacets(triggerDtos);

    const filtered = filterAutomationTriggerGridItems({
      automationNamesById,
      lastRun: query.lastRun ?? 'all',
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

  async get(ownerUserId: string, id: string) {
    const [trigger, latestRuns] = await Promise.all([
      this.getEntity(ownerUserId, id),
      this.runs.latestForTriggers(ownerUserId, id),
    ]);
    return this.mapper.trigger(trigger, latestRuns.get(id));
  }

  async create(dto: CreateAutomationTriggerDto) {
    const ownerUserId = dto.ownerUserId.trim();
    await this.queries.getEntity(ownerUserId, dto.automationId);
    await this.targetApplications.assertOwnerAccess(
      ownerUserId,
      dto.targetApplicationId,
    );
    const triggerConfig = this.triggerScheduler.normalizeConfig(
      dto.triggerType,
      dto.triggerConfig,
    );
    const trigger = this.triggers.create({
      ownerUserId,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      automationId: dto.automationId,
      targetApplicationId: dto.targetApplicationId,
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
    if (
      dto.automationId !== undefined ||
      dto.targetApplicationId !== undefined
    ) {
      await this.getEntity(ownerUserId, id);
    }
    if (dto.automationId !== undefined) {
      await this.queries.getEntity(ownerUserId, dto.automationId);
    }
    if (dto.targetApplicationId !== undefined) {
      await this.targetApplications.assertOwnerAccess(
        ownerUserId,
        dto.targetApplicationId,
      );
    }
    const saved = await this.triggers.updateConfiguration(
      ownerUserId,
      id,
      (current) => {
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
        return {
          name: dto.name?.trim(),
          description:
            dto.description === undefined
              ? undefined
              : dto.description?.trim() || null,
          automationId: dto.automationId,
          targetApplicationId: dto.targetApplicationId,
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
      targetApplicationId: trigger.targetApplicationId,
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
