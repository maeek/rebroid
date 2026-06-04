import { ConflictException, Injectable } from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
import { AndroidAppsStateService } from '../../android-apps/common/services/android-apps-state.service';
import { AndroidAppsNetworkPolicyService } from '../../android-apps/network/services/android-apps-network-policy.service';
import { AndroidAppsSidecarAdbService } from '../../android-apps/viewer/services/android-apps-sidecar-adb.service';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import {
  Automation,
  AutomationLastStatus,
} from '../entities/automation.entity';
import {
  AutomationRun,
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationsRepository } from '../persistence/automations.repository';
import { AutomationDefinition } from '../definition/automation-definition.types';
import { AutomationStepResult } from './automation-runner.types';

const terminalStatuses = new Set<AutomationRunStatus>([
  AutomationRunStatus.Success,
  AutomationRunStatus.Failed,
  AutomationRunStatus.Canceled,
]);

@Injectable()
export class AutomationRunnerService {
  constructor(
    private readonly automations: AutomationsRepository,
    private readonly runs: AutomationRunsRepository,
    private readonly apps: AndroidAppsStateService,
    private readonly registry: AutomationCommandRegistryService,
    private readonly adb: AndroidAppsSidecarAdbService,
    private readonly networkPolicy: AndroidAppsNetworkPolicyService,
  ) {}

  async enqueue(
    automation: Automation,
    trigger: AutomationRunTrigger,
    targetApplicationId?: string | null,
  ) {
    const resolvedTarget =
      targetApplicationId ?? automation.targetApplicationId;
    if (!resolvedTarget) {
      throw new ConflictException(
        'A target application is required to run an automation.',
      );
    }

    const active = await this.runs.findActiveByTarget(resolvedTarget);
    if (active) {
      throw new ConflictException(
        `Automation run "${active.id}" is already active for target application "${resolvedTarget}".`,
      );
    }

    const run = await this.runs.save(
      this.runs.create({
        automationId: automation.id,
        ownerUserId: automation.ownerUserId,
        targetApplicationId: resolvedTarget,
        trigger,
        status: AutomationRunStatus.Queued,
        startedAt: null,
        completedAt: null,
        stepResultsJson: '[]',
        error: null,
      }),
    );

    void this.execute(run.id, automation.id);
    return run;
  }

  async execute(runId: string, automationId: string) {
    const automations = await this.automations.findByIds([automationId]);
    const automation = automations[0];
    if (!automation) {
      return;
    }
    const run = await this.runs.findByOwnerAndId(automation.ownerUserId, runId);
    if (!run || terminalStatuses.has(run.status)) {
      return;
    }

    const app = await this.apps.get(run.targetApplicationId);
    const definition = JSON.parse(
      automation.definitionJson,
    ) as AutomationDefinition;
    const results: AutomationStepResult[] = [];
    run.status = AutomationRunStatus.Running;
    run.startedAt = new Date();
    run.stepResultsJson = JSON.stringify(results);
    await this.runs.save(run);

    let failed = false;
    for (const step of definition.spec.steps) {
      const startedAt = new Date().toISOString();
      try {
        const result = await this.registry.execute(step.uses, step.with, {
          app,
          adb: this.adb,
          networkPolicy: this.networkPolicy,
        });
        const completedAt = new Date().toISOString();
        results.push({
          stepId: step.id,
          uses: step.uses,
          status: 'success',
          startedAt,
          completedAt,
          output: {
            summary: result.summary,
            ...(result.data ?? {}),
          },
          error: null,
        });
        run.stepResultsJson = JSON.stringify(results);
        await this.runs.save(run);

        if (result.data?.stop === true) {
          break;
        }
      } catch (error) {
        const completedAt = new Date().toISOString();
        const message = getErrorMessage(error);
        results.push({
          stepId: step.id,
          uses: step.uses,
          status: 'failed',
          startedAt,
          completedAt,
          output: null,
          error: message,
        });
        run.stepResultsJson = JSON.stringify(results);
        run.error = message;
        await this.runs.save(run);
        failed = true;
        break;
      }
    }

    run.completedAt = new Date();
    run.status = failed
      ? AutomationRunStatus.Failed
      : AutomationRunStatus.Success;
    await this.runs.save(run);

    automation.lastStatus = failed
      ? AutomationLastStatus.Failed
      : AutomationLastStatus.Success;
    automation.lastError = failed ? run.error : null;
    await this.automations.save(automation);
  }
}
