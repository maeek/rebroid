import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AutomationsGridPageDto,
  ListAutomationsGridQueryDto,
} from '../dto/automation.dto';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationTriggersRepository } from '../persistence/automation-triggers.repository';
import { AutomationsRepository } from '../persistence/automations.repository';
import { AutomationsDtoMapper } from './automations-dto-mapper.service';
import {
  automationGridFacets,
  filterAutomationGridItems,
  sortAutomationGridItems,
} from './automations-grid-utils';

@Injectable()
export class AutomationsQueryService {
  constructor(
    private readonly automations: AutomationsRepository,
    private readonly triggers: AutomationTriggersRepository,
    private readonly runs: AutomationRunsRepository,
    private readonly mapper: AutomationsDtoMapper,
  ) {}

  async list(ownerUserId: string) {
    const [automations, latestRuns] = await Promise.all([
      this.automations.listByOwner(ownerUserId),
      this.runs.latestForAutomations(ownerUserId),
    ]);
    return automations.map((automation) =>
      this.mapper.automation(automation, latestRuns.get(automation.id)),
    );
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
    const [automations, triggers, latestRuns] = await Promise.all([
      this.automations.listByOwner(ownerUserId),
      this.triggers.listByOwner(ownerUserId),
      this.runs.latestForAutomations(ownerUserId),
    ]);

    const targetApplicationIdsByAutomation = new Map<string, Set<string>>();
    for (const trigger of triggers) {
      const appIds =
        targetApplicationIdsByAutomation.get(trigger.automationId) ??
        new Set<string>();
      appIds.add(trigger.targetApplicationId);
      targetApplicationIdsByAutomation.set(trigger.automationId, appIds);
    }

    const automationDtos = automations.map((automation) =>
      this.mapper.automation(automation, latestRuns.get(automation.id)),
    );
    const facets = automationGridFacets(
      automationDtos,
      triggers.map((trigger) => trigger.targetApplicationId),
    );
    const filtered = filterAutomationGridItems({
      automations: automationDtos,
      lastRun: query.lastRun ?? 'all',
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
    const [automation, latestRuns] = await Promise.all([
      this.getEntity(ownerUserId, id),
      this.runs.latestForAutomations(ownerUserId, id),
    ]);
    return this.mapper.automation(automation, latestRuns.get(id));
  }

  async getEntity(ownerUserId: string, id: string) {
    const automation = await this.automations.findByOwnerAndId(ownerUserId, id);
    if (!automation) {
      throw new NotFoundException(`Automation "${id}" was not found.`);
    }
    return automation;
  }
}
