import { Injectable } from '@nestjs/common';
import { AutomationDefinitionService } from '../definition/automation-definition.service';
import { AutomationDefinition } from '../definition/automation-definition.types';
import {
  AutomationDto,
  AutomationRunDto,
  AutomationTriggerDto,
} from '../dto/automation.dto';
import { Automation } from '../entities/automation.entity';
import { AutomationRun } from '../entities/automation-run.entity';
import { AutomationTrigger } from '../entities/automation-trigger.entity';
import { AutomationStepResult } from '../runner/automation-runner.types';
import { parseAutomationTagsJson } from '../tags/automation-tags';

@Injectable()
export class AutomationsDtoMapper {
  constructor(private readonly definitions: AutomationDefinitionService) {}

  automation(automation: Automation): AutomationDto {
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

  run(run: AutomationRun): AutomationRunDto {
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

  trigger(trigger: AutomationTrigger): AutomationTriggerDto {
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
      triggerConfig: this.triggerConfig(trigger),
      lastRunAt: toIso(trigger.lastRunAt),
      nextRunAt: toIso(trigger.nextRunAt),
      lastStatus: trigger.lastStatus,
      lastError: trigger.lastError,
      createdAt: toIso(trigger.createdAt) ?? new Date().toISOString(),
      updatedAt: toIso(trigger.updatedAt) ?? new Date().toISOString(),
    };
  }

  triggerConfig(trigger: AutomationTrigger) {
    return JSON.parse(trigger.triggerConfigJson) as Record<string, unknown>;
  }
}

const toIso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;
