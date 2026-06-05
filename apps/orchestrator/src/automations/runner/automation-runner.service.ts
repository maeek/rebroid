import { ConflictException, Injectable } from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
import { AndroidApplicationStatus } from '../../android-apps/android-application-status';
import { ApplicationProfileMode } from '../../android-apps/application-profile-mode';
import { AndroidAppsStateService } from '../../android-apps/common/services/android-apps-state.service';
import { AndroidAppsLifecycleService } from '../../android-apps/lifecycle/services/android-apps-lifecycle.service';
import { AndroidAppsNetworkPolicyService } from '../../android-apps/network/services/android-apps-network-policy.service';
import { AndroidAppsDisplaySidecarService } from '../../android-apps/viewer/services/android-apps-display-sidecar.service';
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
import {
  AutomationDefinitionStep,
  AutomationPredicate,
  AutomationRepeatStep,
  AutomationSwitchStep,
  AutomationValueRef,
} from '../definition/automation-definition.types';
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

interface ExecutionState {
  app: Awaited<ReturnType<AndroidAppsStateService['get']>>;
  runId: string;
  trigger: AutomationRunTrigger;
  targetProfileMode: string | null;
  targetProfileName: string | null;
  results: AutomationStepResult[];
  outputsByStepId: Map<string, Record<string, unknown> | null>;
}

interface StepExecutionOptions {
  parentStepId?: string | null;
  path: string;
}

interface StepExecutionResult {
  failed: boolean;
  stopped: boolean;
}

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
    private readonly display: AndroidAppsDisplaySidecarService,
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

    const state: ExecutionState = {
      app,
      runId: run.id,
      trigger: run.trigger,
      targetProfileMode: run.targetProfileMode,
      targetProfileName: run.targetProfileName,
      results,
      outputsByStepId: new Map(),
    };
    const execution = await this.executeSteps(
      definition.spec.steps,
      state,
      run,
      { path: 'steps' },
    );
    const failed = execution.failed;

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

  private async executeSteps(
    steps: AutomationDefinitionStep[],
    state: ExecutionState,
    run: Awaited<ReturnType<AutomationRunsRepository['save']>>,
    options: { parentStepId?: string | null; path: string },
  ): Promise<StepExecutionResult> {
    for (const [index, step] of steps.entries()) {
      const result = await this.executeStep(state, run, step, {
        parentStepId: options.parentStepId ?? null,
        path: `${options.path}[${index}]`,
      });
      if (result.failed || result.stopped) {
        return result;
      }
    }

    return { failed: false, stopped: false };
  }

  private async executeStep(
    state: ExecutionState,
    run: Awaited<ReturnType<AutomationRunsRepository['save']>>,
    step: AutomationDefinitionStep,
    options: StepExecutionOptions,
  ): Promise<StepExecutionResult> {
    if ('uses' in step) {
      return this.executeActionStep(state, run, step, options);
    }
    try {
      if (step.type === 'condition') {
        return this.executeConditionStep(state, run, step, options);
      }
      if (step.type === 'switch') {
        return this.executeSwitchStep(state, run, step, options);
      }
      return this.executeRepeatStep(state, run, step, options);
    } catch (error) {
      const completedAt = new Date().toISOString();
      const message = getErrorMessage(error);
      state.outputsByStepId.set(step.id, null);
      state.results.push({
        stepId: step.id,
        uses: `flow.${step.type}`,
        parentStepId: options.parentStepId ?? null,
        path: options.path,
        status: 'failed',
        startedAt: completedAt,
        completedAt,
        output: null,
        error: message,
      });
      run.error = message;
      await this.saveRunResults(run, state.results);
      return { failed: true, stopped: false };
    }
  }

  private async executeActionStep(
    state: ExecutionState,
    run: Awaited<ReturnType<AutomationRunsRepository['save']>>,
    step: Extract<AutomationDefinitionStep, { uses: string }>,
    options: StepExecutionOptions,
  ): Promise<StepExecutionResult> {
    const startedAt = new Date().toISOString();
    try {
      const result = await this.registry.execute(step.uses, step.with, {
        app: state.app,
        adb: this.adb,
        display: this.display,
        networkPolicy: this.networkPolicy,
      });
      const completedAt = new Date().toISOString();
      const output = {
        summary: result.summary,
        ...(result.data ?? {}),
      };
      state.outputsByStepId.set(step.id, output);
      state.results.push({
        stepId: step.id,
        uses: step.uses,
        parentStepId: options.parentStepId ?? null,
        path: options.path,
        status: 'success',
        startedAt,
        completedAt,
        output,
        error: null,
      });
      await this.saveRunResults(run, state.results);

      return { failed: false, stopped: result.data?.stop === true };
    } catch (error) {
      const completedAt = new Date().toISOString();
      const message = getErrorMessage(error);
      state.outputsByStepId.set(step.id, null);
      state.results.push({
        stepId: step.id,
        uses: step.uses,
        parentStepId: options.parentStepId ?? null,
        path: options.path,
        status: 'failed',
        startedAt,
        completedAt,
        output: null,
        error: message,
      });
      run.error = message;
      await this.saveRunResults(run, state.results);
      return { failed: true, stopped: false };
    }
  }

  private async executeConditionStep(
    state: ExecutionState,
    run: Awaited<ReturnType<AutomationRunsRepository['save']>>,
    step: Extract<AutomationDefinitionStep, { type: 'condition' }>,
    options: StepExecutionOptions,
  ) {
    const matched = this.evaluatePredicate(step.condition, state);
    await this.recordControlStep(
      state,
      run,
      step.id,
      'flow.condition',
      options,
      {
        matched,
        branch: matched ? 'then' : 'else',
      },
    );
    return this.executeSteps(
      matched ? step.then : (step.else ?? []),
      state,
      run,
      {
        parentStepId: step.id,
        path: `${options.path}.${matched ? 'then' : 'else'}`,
      },
    );
  }

  private async executeSwitchStep(
    state: ExecutionState,
    run: Awaited<ReturnType<AutomationRunsRepository['save']>>,
    step: AutomationSwitchStep,
    options: StepExecutionOptions,
  ) {
    const value = this.resolveValueRef(step.value, state);
    const matchingIndex = step.cases.findIndex((item) =>
      Object.is(item.value, value),
    );
    const selectedSteps =
      matchingIndex === -1
        ? (step.default ?? [])
        : step.cases[matchingIndex].steps;
    await this.recordControlStep(state, run, step.id, 'flow.switch', options, {
      value,
      matchedCaseIndex: matchingIndex === -1 ? null : matchingIndex,
      branch: matchingIndex === -1 ? 'default' : `case-${matchingIndex + 1}`,
    });
    return this.executeSteps(selectedSteps, state, run, {
      parentStepId: step.id,
      path:
        matchingIndex === -1
          ? `${options.path}.default`
          : `${options.path}.cases[${matchingIndex}].steps`,
    });
  }

  private async executeRepeatStep(
    state: ExecutionState,
    run: Awaited<ReturnType<AutomationRunsRepository['save']>>,
    step: AutomationRepeatStep,
    options: StepExecutionOptions,
  ) {
    const totalIterations = step.count ?? step.maxIterations;
    let iterations = 0;
    await this.recordControlStep(state, run, step.id, 'flow.repeat', options, {
      maxIterations: step.maxIterations,
      mode: step.count === undefined ? 'while' : 'count',
    });

    while (iterations < totalIterations && iterations < step.maxIterations) {
      if (step.while && !this.evaluatePredicate(step.while, state)) {
        break;
      }
      const result = await this.executeSteps(step.steps, state, run, {
        parentStepId: step.id,
        path: `${options.path}.steps[${iterations}]`,
      });
      iterations += 1;
      if (result.failed || result.stopped) {
        return result;
      }
    }

    state.outputsByStepId.set(step.id, { iterations });
    return { failed: false, stopped: false };
  }

  private async recordControlStep(
    state: ExecutionState,
    run: Awaited<ReturnType<AutomationRunsRepository['save']>>,
    stepId: string,
    uses: string,
    options: StepExecutionOptions,
    output: Record<string, unknown>,
  ) {
    const now = new Date().toISOString();
    const result = {
      summary: output.branch ? String(output.branch) : uses,
      ...output,
    };
    state.outputsByStepId.set(stepId, result);
    state.results.push({
      stepId,
      uses,
      parentStepId: options.parentStepId ?? null,
      path: options.path,
      status: 'success' as const,
      startedAt: now,
      completedAt: now,
      output: result,
      error: null,
    });
    await this.saveRunResults(run, state.results);
  }

  private async saveRunResults(
    run: Awaited<ReturnType<AutomationRunsRepository['save']>>,
    results: AutomationStepResult[],
  ) {
    run.stepResultsJson = JSON.stringify(results);
    await this.runs.save(run);
  }

  private evaluatePredicate(
    predicate: AutomationPredicate,
    state: ExecutionState,
  ) {
    const left = this.resolveValueRef(predicate.left, state);
    if (predicate.operator === 'exists') {
      return left !== undefined && left !== null;
    }
    const right = predicate.right
      ? this.resolveValueRef(predicate.right, state)
      : undefined;
    switch (predicate.operator) {
      case 'equals':
        return Object.is(left, right);
      case 'notEquals':
        return !Object.is(left, right);
      case 'contains':
        return String(left ?? '').includes(String(right ?? ''));
      case 'greaterThan':
        return Number(left) > Number(right);
      case 'greaterThanOrEqual':
        return Number(left) >= Number(right);
      case 'lessThan':
        return Number(left) < Number(right);
      case 'lessThanOrEqual':
        return Number(left) <= Number(right);
      case 'matches':
        return new RegExp(String(right ?? '')).test(String(left ?? ''));
      default:
        return false;
    }
  }

  private resolveValueRef(ref: AutomationValueRef, state: ExecutionState) {
    if (ref.source === 'literal') {
      return ref.value;
    }
    if (ref.source === 'context') {
      return this.valueAtPath(
        {
          runId: state.runId,
          trigger: state.trigger,
          targetApplicationId: state.app.id,
          targetProfileMode: state.targetProfileMode,
          targetProfileName: state.targetProfileName,
          app: state.app,
        },
        ref.path,
      );
    }
    return this.valueAtPath(
      state.outputsByStepId.get(ref.stepId ?? '') ?? undefined,
      ref.path,
    );
  }

  private valueAtPath(value: unknown, path?: string) {
    if (!path) {
      return value;
    }
    return path.split('.').reduce<unknown>((current, segment) => {
      if (current === undefined || current === null) {
        return undefined;
      }
      if (Array.isArray(current) && /^\d+$/.test(segment)) {
        return current[Number(segment)];
      }
      if (typeof current === 'object') {
        return (current as Record<string, unknown>)[segment];
      }
      return undefined;
    }, value);
  }
}
