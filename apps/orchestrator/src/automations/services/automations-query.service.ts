import { Injectable, NotFoundException } from '@nestjs/common';
import {
  visitAutomationSteps,
  type AutomationDefinition,
  type AutomationDefinitionStep,
} from '@rebroid/automation-core/definition';
import {
  AutomationOptionDto,
  AutomationsGridPageDto,
  ListAutomationsGridQueryDto,
  RunnableAutomationOptionDto,
} from '../dto/automation.dto';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationTriggersRepository } from '../persistence/automation-triggers.repository';
import { AutomationsRepository } from '../persistence/automations.repository';
import { AutomationsDtoMapper } from './automations-dto-mapper.service';
import { buildAutomationGridPage } from './automations-grid-utils';

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

  async listOptions(ownerUserId: string): Promise<AutomationOptionDto[]> {
    const automations = await this.automations.listByOwner(ownerUserId);
    return automations.map(({ id, name, description, definitionJson }) => {
      const definition = JSON.parse(definitionJson) as AutomationDefinition;
      return {
        id,
        name,
        description,
        tags: definition.metadata.tags ?? [],
        topLevelStepCount: definition.spec.steps.length,
      };
    });
  }

  async listRunnableOptions(
    ownerUserId: string,
  ): Promise<RunnableAutomationOptionDto[]> {
    const automations = await this.automations.listNamesByOwner(ownerUserId);
    return automations.map(({ id, name }) => ({ id, name }));
  }

  async listGrid(
    query: ListAutomationsGridQueryDto,
  ): Promise<AutomationsGridPageDto> {
    const ownerUserId = query.ownerUserId.trim();
    const [automations, triggers, latestRuns] = await Promise.all([
      this.automations.listByOwner(ownerUserId),
      this.triggers.listByOwner(ownerUserId),
      this.runs.latestForAutomations(ownerUserId),
    ]);

    const targetDeviceIdsByAutomation = new Map<string, Set<string>>();
    for (const trigger of triggers) {
      const appIds =
        targetDeviceIdsByAutomation.get(trigger.automationId) ??
        new Set<string>();
      appIds.add(trigger.targetDeviceId);
      targetDeviceIdsByAutomation.set(trigger.automationId, appIds);
    }

    const rows = automations.map((automation) => {
      const definition = JSON.parse(
        automation.definitionJson,
      ) as AutomationDefinition;
      return {
        ...this.mapper.automationSummary(
          automation,
          definition.metadata.tags ?? [],
          latestRuns.get(automation.id),
        ),
        steps: definition.spec.steps,
      };
    });
    const page = buildAutomationGridPage(
      rows,
      query,
      targetDeviceIdsByAutomation,
    );
    return {
      ...page,
      items: page.items.map(({ steps, ...summary }) => ({
        ...summary,
        stepCount: countAutomationSteps(steps),
        targetDeviceIds: Array.from(
          targetDeviceIdsByAutomation.get(summary.id) ?? [],
        ),
      })),
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

const countAutomationSteps = (steps: AutomationDefinitionStep[]) => {
  let count = 0;
  visitAutomationSteps(steps, () => {
    count += 1;
  });
  return count;
};
