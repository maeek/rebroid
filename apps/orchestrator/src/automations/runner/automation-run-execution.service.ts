import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
import { AutomationRunStatus } from '../entities/automation-run.entity';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationRunnableResolverService } from './automation-runnable-resolver.service';
import { AutomationExecutionState } from './automation-runner-execution.types';
import { AutomationStepExecutorService } from './automation-step-executor.service';
import { AutomationStepResult } from './automation-runner.types';
import { EphemeralAutomationRegistryService } from './ephemeral-automation-registry.service';
import { MetricsService } from '../../metrics/metrics.service';
import { AutomationRunnerTargetService } from './automation-runner-target.service';
import { AutomationAuthorizationError } from './automation-run-authorization.service';
import type {
  AdmitAutomationTargetStart,
  AutomationRunTargetOptions,
} from './automation-runner-options';

interface AutomationRunExecutionInput {
  runId: string;
  automationId: string;
  abortSignal: AbortSignal;
  targetOptions: AutomationRunTargetOptions;
  admitTargetStart: AdmitAutomationTargetStart;
}

@Injectable()
export class AutomationRunExecutionService {
  private readonly logger = new Logger(AutomationRunExecutionService.name);

  constructor(
    private readonly runs: AutomationRunsRepository,
    private readonly events: AutomationRunEventBus,
    private readonly runnableResolver: AutomationRunnableResolverService,
    private readonly stepExecutor: AutomationStepExecutorService,
    private readonly targets: AutomationRunnerTargetService,
    private readonly ephemeralAutomations: EphemeralAutomationRegistryService,
    private readonly metrics: MetricsService,
  ) {}

  async execute(input: AutomationRunExecutionInput) {
    let runnable: Awaited<
      ReturnType<AutomationRunnableResolverService['resolve']>
    > = null;
    try {
      runnable = await this.runnableResolver.resolve(input.automationId);
      const queuedRun = await this.runs.findById(input.runId);
      if (
        queuedRun?.status !== AutomationRunStatus.Queued ||
        input.abortSignal.aborted
      )
        return;
      if (!runnable) {
        await this.failActiveRun(
          queuedRun.id,
          'Automation definition is no longer available.',
        );
        return;
      }

      const { app, canUseInternet } = await this.targets.prepareTarget({
        ownerUserId: queuedRun.ownerUserId,
        targetApplicationId: queuedRun.targetApplicationId,
        definition: runnable.definition,
        options: input.targetOptions,
        abortSignal: input.abortSignal,
        admitTargetStart: input.admitTargetStart,
      });
      if (input.abortSignal.aborted) return;

      const run = await this.events.transitionRun(
        queuedRun.id,
        [AutomationRunStatus.Queued],
        {
          status: AutomationRunStatus.Running,
          targetProfileMode: app.profileMode,
          targetProfileName: app.profileName || 'default',
          startedAt: new Date(),
          error: null,
        },
        {
          type: 'run.started',
          message: 'Automation started.',
          data: { automationId: runnable.entity.id },
        },
      );
      if (
        run?.status !== AutomationRunStatus.Running ||
        input.abortSignal.aborted
      )
        return;
      this.metrics.automationRunStarted();

      const results: AutomationStepResult[] = [];
      const state: AutomationExecutionState = {
        app,
        canUseInternet,
        runId: run.id,
        trigger: run.trigger,
        targetProfileMode: run.targetProfileMode,
        targetProfileName: run.targetProfileName,
        results,
        outputsByStepId: new Map(),
      };
      const execution = await this.stepExecutor.executeSteps(
        runnable.definition.spec.steps,
        state,
        run,
        {
          path: 'steps',
          abortSignal: input.abortSignal,
          isRunCanceled: () => input.abortSignal.aborted,
        },
      );
      const failed = execution.failed;
      const status = input.abortSignal.aborted
        ? AutomationRunStatus.Canceled
        : failed
          ? AutomationRunStatus.Failed
          : AutomationRunStatus.Success;
      const completed = await this.events.transitionRun(
        run.id,
        [AutomationRunStatus.Running],
        {
          status,
          completedAt: new Date(),
          error: failed ? run.error : null,
        },
        {
          type: terminalEventType(status),
          message: terminalMessage(status, run.error),
        },
      );
      if (!completed) return;

      this.metrics.automationRunFinished(
        completed.trigger,
        completed.status,
        completed.startedAt,
      );
    } catch (error) {
      if (input.abortSignal.aborted) return;
      const run = await this.runs.findById(input.runId);
      if (run) {
        const failed = await this.failActiveRun(
          run.id,
          getErrorMessage(error),
          error instanceof AutomationAuthorizationError
            ? {
                requestId: error.requestId,
                code: error.code,
                service: 'web',
                ...(error.httpStatus === undefined
                  ? {}
                  : { httpStatus: error.httpStatus }),
              }
            : undefined,
        );
        if (failed) {
          this.metrics.automationRunFinished(
            failed.trigger,
            failed.status,
            failed.startedAt,
          );
        }
      }
      this.logger.error(
        `Automation run ${input.runId} failed unexpectedly: ${getErrorMessage(error)}`,
      );
    } finally {
      this.ephemeralAutomations.delete(
        runnable?.ephemeral ? runnable.entity.id : input.automationId,
      );
    }
  }

  private async failActiveRun(
    runId: string,
    message: string,
    data?: Record<string, unknown>,
  ) {
    return this.events.transitionRun(
      runId,
      [AutomationRunStatus.Queued, AutomationRunStatus.Running],
      {
        status: AutomationRunStatus.Failed,
        completedAt: new Date(),
        error: message,
      },
      { type: 'run.failed', message, ...(data ? { data } : {}) },
    );
  }
}

const terminalEventType = (status: AutomationRunStatus) => {
  if (status === AutomationRunStatus.Canceled) return 'run.canceled';
  if (status === AutomationRunStatus.Failed) return 'run.failed';
  return 'run.completed';
};

const terminalMessage = (status: AutomationRunStatus, error: string | null) => {
  if (status === AutomationRunStatus.Canceled) return 'Automation canceled.';
  if (status === AutomationRunStatus.Failed)
    return error ?? 'Automation failed.';
  return 'Automation completed.';
};
