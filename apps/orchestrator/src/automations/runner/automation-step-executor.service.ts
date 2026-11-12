import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
import { waitForOperation } from '../../common/wait-for-operation';
import {
  ANDROID_APPS_AUTOMATION,
  type AndroidAppsAutomationPort,
} from '../../android-apps/contracts/android-apps-automation.port';
import {
  AutomationDefinitionStep,
  AutomationRepeatStep,
  AutomationSwitchStep,
} from '@rebroid/automation-core/definition';
import { AutomationAiHarnessService } from '../ai/automation-ai-harness.service';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import type {
  AutomationCommandExecutor,
  AutomationCommandResult,
  AutomationTargetExecutor,
} from '../commands/automation-command.types';
import { adHocAiAutomationIdPrefix } from '../contracts/automation-run-kind';
import { AutomationConditionService } from '../condition/automation-condition.service';
import { AutomationRun } from '../entities/automation-run.entity';
import { AutomationRunnerRecorderService } from './automation-runner-recorder.service';
import {
  AutomationExecutionState,
  AutomationStepExecutionOptions,
  AutomationStepExecutionResult,
} from './automation-runner-execution.types';

const stoppedExecution = { failed: false, stopped: true } as const;
const commandsWithoutTargetWork = new Set([
  'ai.run',
  'android.wait',
  'debug.log',
  'flow.stop',
  'flow.fail',
]);

const runCanceled = (runId: string, options: AutomationStepExecutionOptions) =>
  options.abortSignal?.aborted || options.isRunCanceled(runId);

@Injectable()
export class AutomationStepExecutorService {
  constructor(
    private readonly registry: AutomationCommandRegistryService,
    private readonly aiHarness: AutomationAiHarnessService,
    private readonly recorder: AutomationRunnerRecorderService,
    private readonly conditions: AutomationConditionService,
    @Inject(ANDROID_APPS_AUTOMATION)
    private readonly applications: AndroidAppsAutomationPort,
  ) {}

  async executeSteps(
    steps: AutomationDefinitionStep[],
    state: AutomationExecutionState,
    run: AutomationRun,
    options: AutomationStepExecutionOptions,
  ): Promise<AutomationStepExecutionResult> {
    for (const [index, step] of steps.entries()) {
      if (runCanceled(run.id, options)) {
        return stoppedExecution;
      }
      const result = await this.executeStep(state, run, step, {
        ...options,
        path: `${options.path}[${index}]`,
      });
      if (result.failed || result.stopped) {
        return result;
      }
    }

    return { failed: false, stopped: false };
  }

  private async executeStep(
    state: AutomationExecutionState,
    run: AutomationRun,
    step: AutomationDefinitionStep,
    options: AutomationStepExecutionOptions,
  ): Promise<AutomationStepExecutionResult> {
    if ('uses' in step) {
      return this.executeActionStep(state, run, step, options);
    }
    if (step.type === 'condition') {
      return this.executeConditionStep(state, run, step, options);
    }
    if (step.type === 'switch') {
      return this.executeSwitchStep(state, run, step, options);
    }
    return this.executeRepeatStep(state, run, step, options);
  }

  private async executeActionStep(
    state: AutomationExecutionState,
    run: AutomationRun,
    step: Extract<AutomationDefinitionStep, { uses: string }>,
    options: AutomationStepExecutionOptions,
  ): Promise<AutomationStepExecutionResult> {
    const startedAt = new Date().toISOString();
    await this.recorder.recordActionStarted(
      run,
      state,
      step.id,
      step.uses,
      options,
    );
    if (runCanceled(run.id, options)) return stoppedExecution;
    let result: AutomationCommandResult;
    const pendingAiWork = new Set<Promise<unknown>>();
    try {
      const recordOcrExchange =
        run.automationId &&
        !run.automationId.startsWith(adHocAiAutomationIdPrefix)
          ? this.recorder.ocrExchangeRecorder(run, step.id, options)
          : undefined;
      const commandContext = {
        ...this.applications.automationAdapters(state.canUseInternet),
        recordOcrExchange,
      };
      const expectedTarget = state.app;
      const withTarget: AutomationTargetExecutor = async (
        signal,
        operation,
      ) => {
        signal?.throwIfAborted();
        const pending = options.admitTargetWork(() =>
          this.applications.withAutomationTarget(
            expectedTarget,
            signal,
            (app) => {
              state.app = app;
              return operation(app);
            },
          ),
        );
        if (step.uses !== 'ai.run' || !signal) return pending;
        pendingAiWork.add(pending);
        const forget = () => pendingAiWork.delete(pending);
        void pending.then(forget, forget);
        return waitForOperation(pending, signal);
      };
      const executeCommand: AutomationCommandExecutor = async ({
        uses,
        input,
        signal = options.abortSignal,
        deadline,
        visionSnapshot,
      }) => {
        signal?.throwIfAborted();
        if (runCanceled(run.id, options)) {
          throw new ConflictException('Automation run was canceled.');
        }
        const execute = (app: AutomationExecutionState['app']) =>
          this.registry.execute(uses, input, {
            ...commandContext,
            app,
            abortSignal: signal,
            deadline,
            visionSnapshot,
          });
        return commandsWithoutTargetWork.has(uses)
          ? execute(state.app)
          : withTarget(signal, execute);
      };
      let commandInput = step.with;
      if (step.uses === 'ai.run' && step.with.capabilities === undefined) {
        if (state.defaultAiCapabilities === undefined) {
          throw new ConflictException(
            'Workflow authorization did not provide default AI capabilities.',
          );
        }
        commandInput = {
          ...step.with,
          capabilities: state.defaultAiCapabilities,
        };
      }
      const execute = (app: AutomationExecutionState['app']) =>
        this.registry.execute(step.uses, commandInput, {
          ...commandContext,
          app,
          aiHarness: this.aiHarness,
          runId: state.runId,
          ownerUserId: run.ownerUserId,
          stepId: step.id,
          parentStepId: options.parentStepId ?? null,
          path: options.path,
          abortSignal: options.abortSignal,
          executeCommand,
          withTarget: step.uses === 'ai.run' ? withTarget : undefined,
        });
      result = await (commandsWithoutTargetWork.has(step.uses)
        ? execute(state.app)
        : withTarget(options.abortSignal, execute));
    } catch (error) {
      await Promise.allSettled(pendingAiWork);
      if (runCanceled(run.id, options)) return stoppedExecution;
      const message = getErrorMessage(error);
      const saved = await this.recorder.recordStepFailed(
        run,
        state,
        step.id,
        step.uses,
        options,
        startedAt,
        message,
      );
      return saved ? { failed: true, stopped: false } : stoppedExecution;
    }
    await Promise.allSettled(pendingAiWork);
    if (runCanceled(run.id, options)) return stoppedExecution;
    const saved = await this.recorder.recordActionCompleted(
      run,
      state,
      step.id,
      step.uses,
      options,
      startedAt,
      result,
    );
    return saved
      ? { failed: false, stopped: result.data?.stop === true }
      : stoppedExecution;
  }

  private async executeConditionStep(
    state: AutomationExecutionState,
    run: AutomationRun,
    step: Extract<AutomationDefinitionStep, { type: 'condition' }>,
    options: AutomationStepExecutionOptions,
  ) {
    const matched = this.conditions.evaluate(step.condition, {
      ...state,
      app: state.app as unknown as Record<string, unknown>,
    });
    const recorded = await this.recorder.recordControlCompleted(
      run,
      state,
      step.id,
      'flow.condition',
      options,
      {
        matched,
        branch: matched ? 'then' : 'else',
      },
    );
    if (!recorded) return stoppedExecution;
    return this.executeSteps(
      matched ? step.then : (step.else ?? []),
      state,
      run,
      {
        ...options,
        parentStepId: step.id,
        path: `${options.path}.${matched ? 'then' : 'else'}`,
      },
    );
  }

  private async executeSwitchStep(
    state: AutomationExecutionState,
    run: AutomationRun,
    step: AutomationSwitchStep,
    options: AutomationStepExecutionOptions,
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
    const recorded = await this.recorder.recordControlCompleted(
      run,
      state,
      step.id,
      'flow.switch',
      options,
      {
        value,
        matchedCaseIndex: matchingIndex === -1 ? null : matchingIndex,
        branch: matchingIndex === -1 ? 'default' : `case-${matchingIndex + 1}`,
      },
    );
    if (!recorded) return stoppedExecution;
    return this.executeSteps(selectedSteps, state, run, {
      ...options,
      parentStepId: step.id,
      path:
        matchingIndex === -1
          ? `${options.path}.default`
          : `${options.path}.cases[${matchingIndex}].steps`,
    });
  }

  private async executeRepeatStep(
    state: AutomationExecutionState,
    run: AutomationRun,
    step: AutomationRepeatStep,
    options: AutomationStepExecutionOptions,
  ) {
    const totalIterations = step.count ?? step.maxIterations;
    let iterations = 0;
    const recorded = await this.recorder.recordControlCompleted(
      run,
      state,
      step.id,
      'flow.repeat',
      options,
      {
        maxIterations: step.maxIterations,
        mode: step.count === undefined ? 'while' : 'count',
      },
    );
    if (!recorded) return stoppedExecution;

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
        ...options,
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
}
