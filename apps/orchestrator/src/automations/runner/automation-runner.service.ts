import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getErrorMessage } from '../../common/error-message';
import { AndroidApplicationStatus } from '../../android-apps/android-application-status';
import { ApplicationProfileMode } from '../../android-apps/application-profile-mode';
import { AndroidAppsStateService } from '../../android-apps/common/services/android-apps-state.service';
import { AndroidAppsLifecycleService } from '../../android-apps/lifecycle/services/android-apps-lifecycle.service';
import { AndroidAppsNetworkPolicyService } from '../../android-apps/network/services/android-apps-network-policy.service';
import { AndroidAppsDisplaySidecarService } from '../../android-apps/viewer/services/android-apps-display-sidecar.service';
import { AndroidAppsSidecarAdbService } from '../../android-apps/viewer/services/android-apps-sidecar-adb.service';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationAiHarnessService } from '../ai/automation-ai-harness.service';
import { AutomationConditionService } from '../condition/automation-condition.service';
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
import { AutomationDefinition } from '@rebroid/automation-core/definition';
import {
  AutomationDefinitionStep,
  AutomationRepeatStep,
  AutomationSwitchStep,
} from '@rebroid/automation-core/definition';
import { AutomationStepResult } from './automation-runner.types';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationRunnerRecorderService } from './automation-runner-recorder.service';

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
  abortSignal?: AbortSignal;
  parentStepId?: string | null;
  path: string;
}

interface StepExecutionResult {
  failed: boolean;
  stopped: boolean;
}

interface RunnableAutomation {
  definition: AutomationDefinition;
  entity: Automation;
  ephemeral: boolean;
}

@Injectable()
export class AutomationRunnerService {
  private readonly canceledRunIds = new Set<string>();
  private readonly ephemeralAutomations = new Map<string, RunnableAutomation>();
  private readonly activeRunAbortControllers = new Map<
    string,
    AbortController
  >();

  constructor(
    private readonly automations: AutomationsRepository,
    private readonly runs: AutomationRunsRepository,
    private readonly triggers: AutomationTriggersRepository,
    private readonly apps: AndroidAppsStateService,
    private readonly lifecycle: AndroidAppsLifecycleService,
    private readonly registry: AutomationCommandRegistryService,
    private readonly aiHarness: AutomationAiHarnessService,
    private readonly events: AutomationRunEventBus,
    private readonly recorder: AutomationRunnerRecorderService,
    private readonly conditions: AutomationConditionService,
    private readonly adb: AndroidAppsSidecarAdbService,
    private readonly display: AndroidAppsDisplaySidecarService,
    private readonly networkPolicy: AndroidAppsNetworkPolicyService,
  ) {}

  async enqueue(
    automation: Automation,
    trigger: AutomationRunTrigger,
    options: AutomationRunTargetOptions = {},
  ) {
    return this.enqueueRunnable(
      {
        definition: JSON.parse(
          automation.definitionJson,
        ) as AutomationDefinition,
        entity: automation,
        ephemeral: false,
      },
      trigger,
      options,
    );
  }

  async enqueueEphemeral(
    ownerUserId: string,
    definition: AutomationDefinition,
    trigger: AutomationRunTrigger,
    options: AutomationRunTargetOptions = {},
  ) {
    const now = new Date();
    const automation = this.automations.create({
      id: `ephemeral-ai-${randomUUID()}`,
      ownerUserId: ownerUserId.trim(),
      name: definition.metadata.name,
      description: definition.metadata.description ?? null,
      definitionJson: JSON.stringify(definition),
      lastStatus: AutomationLastStatus.Running,
      lastRunAt: now,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
    this.ephemeralAutomations.set(automation.id, {
      definition,
      entity: automation,
      ephemeral: true,
    });
    return this.enqueueRunnable(
      { definition, entity: automation, ephemeral: true },
      trigger,
      options,
    );
  }

  private async enqueueRunnable(
    runnable: RunnableAutomation,
    trigger: AutomationRunTrigger,
    options: AutomationRunTargetOptions = {},
  ) {
    const automation = runnable.entity;
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

    await this.events.emit({
      runId: run.id,
      ownerUserId: run.ownerUserId,
      type: 'run.queued',
      message: 'Automation queued.',
      data: { automationId: automation.id, trigger },
    });
    void this.execute(run.id, automation.id);
    return run;
  }

  async cancel(ownerUserId: string, runId: string) {
    const run = await this.runs.findByOwnerAndId(ownerUserId, runId);
    if (!run) {
      throw new NotFoundException(`Automation run "${runId}" was not found.`);
    }
    if (terminalStatuses.has(run.status)) {
      return run;
    }
    this.canceledRunIds.add(run.id);
    this.activeRunAbortControllers.get(run.id)?.abort();
    run.status = AutomationRunStatus.Canceled;
    run.completedAt = new Date();
    run.error = 'Canceled by user.';
    await this.runs.save(run);
    await this.events.emit({
      runId: run.id,
      ownerUserId: run.ownerUserId,
      type: 'run.canceled',
      message: 'Automation canceled.',
    });
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
    const runnable = await this.resolveRunnableAutomation(automationId);
    if (!runnable) {
      return;
    }
    const automation = runnable.entity;
    const run = await this.runs.findByOwnerAndId(automation.ownerUserId, runId);
    if (!run || terminalStatuses.has(run.status)) {
      return;
    }

    const app = await this.apps.get(run.targetApplicationId);
    const definition = runnable.definition;
    const abortController = new AbortController();
    this.activeRunAbortControllers.set(run.id, abortController);
    const results: AutomationStepResult[] = [];
    run.status = AutomationRunStatus.Running;
    run.startedAt = new Date();
    run.stepResultsJson = JSON.stringify(results);
    await this.runs.save(run);
    await this.events.emit({
      runId: run.id,
      ownerUserId: run.ownerUserId,
      type: 'run.started',
      message: 'Automation started.',
      data: { automationId: automation.id },
    });

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
      { path: 'steps', abortSignal: abortController.signal },
    );
    this.activeRunAbortControllers.delete(run.id);
    const canceled = this.canceledRunIds.has(run.id);
    const failed = execution.failed;

    run.completedAt = new Date();
    run.status = canceled
      ? AutomationRunStatus.Canceled
      : failed
        ? AutomationRunStatus.Failed
        : AutomationRunStatus.Success;
    await this.runs.save(run);
    this.canceledRunIds.delete(run.id);
    await this.events.emit({
      runId: run.id,
      ownerUserId: run.ownerUserId,
      type:
        run.status === AutomationRunStatus.Canceled
          ? 'run.canceled'
          : failed
            ? 'run.failed'
            : 'run.completed',
      message:
        run.status === AutomationRunStatus.Canceled
          ? 'Automation canceled.'
          : failed
            ? (run.error ?? 'Automation failed.')
            : 'Automation completed.',
    });

    if (runnable.ephemeral) {
      this.ephemeralAutomations.delete(automation.id);
      return;
    }

    await this.updatePersistedAutomationAfterRun(automation, run, failed);
  }

  private async resolveRunnableAutomation(
    automationId: string,
  ): Promise<RunnableAutomation | null> {
    const ephemeral = this.ephemeralAutomations.get(automationId);
    if (ephemeral) {
      return ephemeral;
    }
    const automations = await this.automations.findByIds([automationId]);
    const automation = automations[0];
    if (!automation) {
      return null;
    }
    return {
      definition: JSON.parse(automation.definitionJson) as AutomationDefinition,
      entity: automation,
      ephemeral: false,
    };
  }

  private async updatePersistedAutomationAfterRun(
    automation: Automation,
    run: Awaited<ReturnType<AutomationRunsRepository['save']>>,
    failed: boolean,
  ) {
    automation.lastStatus =
      run.status === AutomationRunStatus.Canceled || failed
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
    options: StepExecutionOptions,
  ): Promise<StepExecutionResult> {
    for (const [index, step] of steps.entries()) {
      if (this.canceledRunIds.has(run.id)) {
        return { failed: false, stopped: true };
      }
      const result = await this.executeStep(state, run, step, {
        parentStepId: options.parentStepId ?? null,
        path: `${options.path}[${index}]`,
        abortSignal: options.abortSignal,
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
      await this.recorder.recordStepFailed(
        run,
        state,
        step.id,
        `flow.${step.type}`,
        options,
        completedAt,
        message,
        false,
      );
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
    await this.recorder.recordActionStarted(
      run,
      state,
      step.id,
      step.uses,
      options,
    );
    try {
      const executeTool = async (tool: {
        name: string;
        arguments: Record<string, unknown>;
      }) => {
        if (this.canceledRunIds.has(run.id)) {
          throw new ConflictException('Automation run was canceled.');
        }
        return this.registry.execute(tool.name, tool.arguments, {
          app: state.app,
          adb: this.adb,
          display: this.display,
          networkPolicy: this.networkPolicy,
        });
      };
      const result = await this.registry.execute(step.uses, step.with, {
        app: state.app,
        adb: this.adb,
        display: this.display,
        networkPolicy: this.networkPolicy,
        aiHarness: this.aiHarness,
        runId: state.runId,
        ownerUserId: run.ownerUserId,
        stepId: step.id,
        parentStepId: options.parentStepId ?? null,
        path: options.path,
        abortSignal: options.abortSignal,
        toolExecutor: executeTool,
      });
      await this.recorder.recordActionCompleted(
        run,
        state,
        step.id,
        step.uses,
        options,
        startedAt,
        result,
      );

      return { failed: false, stopped: result.data?.stop === true };
    } catch (error) {
      const message = getErrorMessage(error);
      await this.recorder.recordStepFailed(
        run,
        state,
        step.id,
        step.uses,
        options,
        startedAt,
        message,
        true,
      );
      return { failed: true, stopped: false };
    }
  }

  private async executeConditionStep(
    state: ExecutionState,
    run: Awaited<ReturnType<AutomationRunsRepository['save']>>,
    step: Extract<AutomationDefinitionStep, { type: 'condition' }>,
    options: StepExecutionOptions,
  ) {
    const matched = this.conditions.evaluate(step.condition, {
      ...state,
      app: state.app as unknown as Record<string, unknown>,
    });
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
        abortSignal: options.abortSignal,
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
    const value = this.conditions.resolveValueRef(step.value, {
      ...state,
      app: state.app as unknown as Record<string, unknown>,
    });
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
      abortSignal: options.abortSignal,
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
      if (
        step.while &&
        !this.conditions.evaluate(step.while, {
          ...state,
          app: state.app as unknown as Record<string, unknown>,
        })
      ) {
        break;
      }
      const result = await this.executeSteps(step.steps, state, run, {
        abortSignal: options.abortSignal,
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
    await this.recorder.recordControlCompleted(
      run,
      state,
      stepId,
      uses,
      options,
      output,
    );
  }
}
