import { Injectable } from '@nestjs/common';
import { AutomationDefinitionService } from '../definition/automation-definition.service';
import { AutomationDefinition } from '@rebroid/automation-core/definition';
import { AutomationDto } from '../dto/automation.dto';
import { AutomationRunDto } from '../dto/automation-run.dto';
import { AutomationTriggerDto } from '../dto/automation-trigger.dto';
import {
  Automation,
  AutomationLastStatus,
} from '../entities/automation.entity';
import {
  AutomationRun,
  AutomationRunStatus,
} from '../entities/automation-run.entity';
import { AutomationTrigger } from '../entities/automation-trigger.entity';
import { AutomationStepResult } from '../runner/automation-runner.types';
import { parseAutomationTagsJson } from '../tags/automation-tags';

@Injectable()
export class AutomationsDtoMapper {
  constructor(private readonly definitions: AutomationDefinitionService) {}

  automation(automation: Automation, latestRun?: AutomationRun): AutomationDto {
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
      ...runSummary(automation, latestRun),
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

  trigger(
    trigger: AutomationTrigger,
    latestRun?: AutomationRun,
  ): AutomationTriggerDto {
    return {
      id: trigger.id,
      ownerUserId: trigger.ownerUserId,
      name: trigger.name,
      description: trigger.description,
      automationId: trigger.automationId,
      targetApplicationId: trigger.targetApplicationId,
      profileMode: trigger.profileMode,
      profileName: trigger.profileName,
      enabled: trigger.enabled,
      tags: parseAutomationTagsJson(trigger.tagsJson),
      triggerType: trigger.triggerType,
      triggerConfig: this.triggerConfig(trigger),
      ...runSummary(trigger, latestRun, trigger.lastEnqueueFailureAt),
      nextRunAt: toIso(trigger.nextRunAt),
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

const runSummary = (
  resource: Pick<Automation, 'lastStatus' | 'lastRunAt' | 'lastError'>,
  run?: AutomationRun,
  lastEnqueueFailureAt?: Date | null,
) => {
  if (!run)
    return {
      lastRunAt: toIso(resource.lastRunAt),
      lastStatus: resource.lastStatus,
      lastError: resource.lastError,
    };

  const lastRunAt = toIso(run.completedAt ?? run.startedAt ?? run.createdAt);
  if (lastEnqueueFailureAt && lastEnqueueFailureAt > run.createdAt)
    return {
      lastRunAt,
      lastStatus: AutomationLastStatus.Failed,
      lastError: resource.lastError,
    };
  let lastStatus = AutomationLastStatus.Running;
  if (run.status === AutomationRunStatus.Success)
    lastStatus = AutomationLastStatus.Success;
  if (
    run.status === AutomationRunStatus.Failed ||
    run.status === AutomationRunStatus.Canceled
  ) {
    lastStatus = AutomationLastStatus.Failed;
  }
  return {
    lastRunAt,
    lastStatus,
    lastError: lastStatus === AutomationLastStatus.Failed ? run.error : null,
  };
};
