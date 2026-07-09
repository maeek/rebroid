import { ConflictException, Injectable } from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
import { AndroidAppsFacadeService } from '../../android-apps/common/services/android-apps-facade.service';
import {
  AutomationDefinitionStep,
  AutomationRepeatStep,
  AutomationSwitchStep,
} from '@rebroid/automation-core/definition';
import { AutomationAiHarnessService } from '../ai/automation-ai-harness.service';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationConditionService } from '../condition/automation-condition.service';
import { AutomationRun } from '../entities/automation-run.entity';
import { AutomationRunnerRecorderService } from './automation-runner-recorder.service';
import {
  AutomationExecutionState,
  AutomationStepExecutionOptions,
  AutomationStepExecutionResult,
} from './automation-runner-execution.types';

@Injectable()
export class AutomationStepExecutorService {
  constructor(
    private readonly registry: AutomationCommandRegistryService,
    private readonly aiHarness: AutomationAiHarnessService,
    private readonly recorder: AutomationRunnerRecorderService,
    private readonly conditions: AutomationConditionService,
    private readonly applications: AndroidAppsFacadeService,
  ) {}

  async executeSteps(
    steps: AutomationDefinitionStep[],
    state: AutomationExecutionState,
    run: AutomationRun,
    options: AutomationStepExecutionOptions,
  ): Promise<AutomationStepExecutionResult> {
    for (const [index, step] of steps.entries()) {
      if (options.isRunCanceled(run.id)) {
        return { failed: false, stopped: true };
      }
      const result = await this.executeStep(state, run, step, {
        parentStepId: options.parentStepId ?? null,
        path: `${options.path}[${index}]`,
        abortSignal: options.abortSignal,
        isRunCanceled: options.isRunCanceled,
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
    try {
      const executeTool = async (tool: {
        name: string;
        arguments: Record<string, unknown>;
      }) => {
        if (options.isRunCanceled(run.id)) {
          throw new ConflictException('Automation run was canceled.');
        }
        return this.registry.execute(tool.name, tool.arguments, {
          app: state.app,
          ...this.applications.automationAdapters(),
        });
      };
      const result = await this.registry.execute(step.uses, step.with, {
        app: state.app,
        ...this.applications.automationAdapters(),
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
    state: AutomationExecutionState,
    run: AutomationRun,
    step: Extract<AutomationDefinitionStep, { type: 'condition' }>,
    options: AutomationStepExecutionOptions,
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
        isRunCanceled: options.isRunCanceled,
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
      isRunCanceled: options.isRunCanceled,
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
        isRunCanceled: options.isRunCanceled,
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
    state: AutomationExecutionState,
    run: AutomationRun,
    stepId: string,
    uses: string,
    options: AutomationStepExecutionOptions,
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
