import { ConflictException, Injectable } from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
import { AndroidApplicationStatus } from '../../android-apps/android-application-status';
import { ApplicationProfileMode } from '../../android-apps/application-profile-mode';
import { AndroidAppsStateService } from '../../android-apps/common/services/android-apps-state.service';
import { AndroidAppsLifecycleService } from '../../android-apps/lifecycle/services/android-apps-lifecycle.service';
import { AndroidAppsNetworkPolicyService } from '../../android-apps/network/services/android-apps-network-policy.service';
import { AndroidAppsSidecarAdbService } from '../../android-apps/viewer/services/android-apps-sidecar-adb.service';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import {
  Automation,
  AutomationLastStatus,
} from '../entities/automation.entity';
import {
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationTriggersRepository } from '../persistence/automation-triggers.repository';
import { AutomationsRepository } from '../persistence/automations.repository';
import { AutomationDefinition } from '../definition/automation-definition.types';
import { AutomationStepResult } from './automation-runner.types';

export enum AutomationRunStartPolicy {
  RequireRunning = 'require-running',
  StartIfNeeded = 'start-if-needed',
}

export interface AutomationRunTargetOptions {
  targetApplicationId?: string | null;
  targetProfileMode?: string | null;
  targetProfileName?: string | null;
  automationTriggerId?: string | null;
  startPolicy?: AutomationRunStartPolicy;
}

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
    private readonly triggers: AutomationTriggersRepository,
    private readonly apps: AndroidAppsStateService,
    private readonly lifecycle: AndroidAppsLifecycleService,
    private readonly registry: AutomationCommandRegistryService,
    private readonly adb: AndroidAppsSidecarAdbService,
    private readonly networkPolicy: AndroidAppsNetworkPolicyService,
  ) {}

  async enqueue(
    automation: Automation,
    trigger: AutomationRunTrigger,
    options: AutomationRunTargetOptions = {},
  ) {
    const resolvedTarget = options.targetApplicationId;
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

    const target = await this.prepareTarget(resolvedTarget, options);

    const run = await this.runs.save(
      this.runs.create({
        automationId: automation.id,
        automationTriggerId: options.automationTriggerId ?? null,
        ownerUserId: automation.ownerUserId,
        targetApplicationId: resolvedTarget,
        targetProfileMode: target.profileMode,
        targetProfileName: target.profileName,
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

  private async prepareTarget(
    targetApplicationId: string,
    options: AutomationRunTargetOptions,
  ) {
    const startPolicy =
      options.startPolicy ?? AutomationRunStartPolicy.RequireRunning;
    const requestedProfileMode =
      options.targetProfileMode ?? ApplicationProfileMode.Persistent;
    const requestedProfileName = options.targetProfileName?.trim() || 'default';
    let app = await this.apps.get(targetApplicationId);

    if (app.status === AndroidApplicationStatus.Running) {
      const activeProfileName = app.profileName || 'default';
      if (
        app.profileMode !== requestedProfileMode ||
        activeProfileName !== requestedProfileName
      ) {
        throw new ConflictException(
          `Application is already running with profile "${activeProfileName}" (${app.profileMode}). Stop it before running automation with profile "${requestedProfileName}" (${requestedProfileMode}).`,
        );
      }
      return {
        profileMode: app.profileMode,
        profileName: activeProfileName,
      };
    }

    if (startPolicy !== AutomationRunStartPolicy.StartIfNeeded) {
      throw new ConflictException(
        'Application must be running before this automation can run.',
      );
    }

    await this.lifecycle.start(targetApplicationId, {
      profileMode: requestedProfileMode as ApplicationProfileMode,
      profileName: requestedProfileName,
    });
    app = await this.waitForRunningTarget(targetApplicationId);

    return {
      profileMode: app.profileMode,
      profileName: app.profileName || 'default',
    };
  }

  private async waitForRunningTarget(targetApplicationId: string) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const app = await this.apps.get(targetApplicationId);
      if (app.status === AndroidApplicationStatus.Running) {
        return app;
      }
      if (
        app.status === AndroidApplicationStatus.Error ||
        app.status === AndroidApplicationStatus.Removed ||
        app.status === AndroidApplicationStatus.Removing
      ) {
        throw new ConflictException(
          `Application could not be started for automation run: ${app.statusMessage ?? app.status}.`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new ConflictException(
      'Application did not finish starting before the automation run timeout.',
    );
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
    automation.lastRunAt = run.completedAt;
    automation.lastError = failed ? run.error : null;
    const trigger = run.automationTriggerId
      ? await this.triggers.findByOwnerAndId(
          automation.ownerUserId,
          run.automationTriggerId,
        )
      : null;
    if (trigger) {
      trigger.lastStatus = automation.lastStatus;
      trigger.lastRunAt = run.completedAt;
      trigger.lastError = automation.lastError;
      await this.triggers.save(trigger);
    }
    await this.automations.save(automation);
  }
}
