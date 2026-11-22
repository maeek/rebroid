import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
import { AutomationRunStatus } from '../entities/automation-run.entity';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationRunnableResolverService } from './automation-runnable-resolver.service';
import { AutomationExecutionState } from './automation-runner-execution.types';
import { AutomationStepExecutorService } from './automation-step-executor.service';
import { EphemeralAutomationRegistryService } from './ephemeral-automation-registry.service';
import { MetricsService } from '../../metrics/metrics.service';
import {
  AutomationRunnerTargetService,
  type AutomationTargetPreparationPhase,
} from './automation-runner-target.service';
import { AutomationAuthorizationError } from './automation-run-authorization.service';
import type {
  AdmitAutomationTargetWork,
  AutomationRunTargetOptions,
} from './automation-runner-options';

interface AutomationRunExecutionInput {
  runId: string;
  automationId: string;
  abortSignal: AbortSignal;
  targetOptions: AutomationRunTargetOptions;
  admitTargetWork: AdmitAutomationTargetWork;
}

const preparationMessages: Record<AutomationTargetPreparationPhase, string> = {
  'checking-target': 'Checking the app and profile.',
  'starting-app': 'Starting the app with the selected profile.',
  'waiting-for-android': 'Waiting for Android to be ready.',
};

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
    let endExecution: (() => void) | undefined;
    try {
      const runnable = await this.runnableResolver.resolve(input.automationId);
      const queuedRun = await this.runs.findById(input.runId);
      if (
        queuedRun?.status !== AutomationRunStatus.Queued ||
        input.abortSignal.aborted
      )
        return;
      if (!runnable) {
        await this.finishRun(
          queuedRun.id,
          AutomationRunStatus.Failed,
          'Automation definition is no longer available.',
        );
        return;
      }

      const { target, ...permissions } = await this.targets.prepareTarget({
        ownerUserId: queuedRun.ownerUserId,
        targetApplicationId: queuedRun.targetApplicationId,
        definition: runnable.definition,
        options: input.targetOptions,
        abortSignal: input.abortSignal,
        admitTargetWork: input.admitTargetWork,
        onPreparationPhase: runnable.ephemeral
          ? undefined
          : async (phase, profile) => {
              if (input.abortSignal.aborted) return;
              try {
                await this.events.emitWhileQueued({
                  runId: queuedRun.id,
                  ownerUserId: queuedRun.ownerUserId,
                  type: 'run.preparing',
                  message: preparationMessages[phase],
                  data: { phase, ...profile },
                });
              } catch {
                this.logger.warn(
                  `Could not record target preparation for automation run ${queuedRun.id}.`,
                );
              }
            },
      });
      if (input.abortSignal.aborted) return;

      const run = await this.events.transitionRun(queuedRun.id, {
        status: AutomationRunStatus.Running,
        targetProfileMode: target.profileMode,
        targetProfileName: target.profileName || 'default',
        startedAt: new Date(),
        error: null,
      });
      if (
        run?.status !== AutomationRunStatus.Running ||
        input.abortSignal.aborted
      )
        return;
      endExecution = this.metrics.beginAutomationRunExecution();

      const state: AutomationExecutionState = {
        app: target,
        target,
        ...permissions,
        runId: run.id,
        trigger: run.trigger,
        targetProfileMode: run.targetProfileMode,
        targetProfileName: run.targetProfileName,
        outputsByStepId: new Map(),
      };
      const execution = await this.stepExecutor.executeSteps(
        runnable.definition.spec.steps,
        state,
        run,
        {
          path: 'steps',
          abortSignal: input.abortSignal,
          admitTargetWork: input.admitTargetWork,
        },
      );
      if (input.abortSignal.aborted) return;
      await this.finishRun(
        run.id,
        execution.failed
          ? AutomationRunStatus.Failed
          : AutomationRunStatus.Success,
        execution.failed ? run.error : null,
      );
    } catch (error) {
      if (input.abortSignal.aborted) return;
      await this.finishRun(
        input.runId,
        AutomationRunStatus.Failed,
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
      this.logger.error(
        `Automation run ${input.runId} failed unexpectedly: ${getErrorMessage(error)}`,
      );
    } finally {
      endExecution?.();
      this.ephemeralAutomations.delete(input.automationId);
    }
  }

  private async finishRun(
    runId: string,
    status: AutomationRunStatus.Success | AutomationRunStatus.Failed,
    error: string | null,
    data?: Record<string, unknown>,
  ) {
    const completed = await this.events.transitionRun(
      runId,
      { status, completedAt: new Date(), error },
      data,
    );
    if (completed)
      this.metrics.automationRunFinished(
        completed.trigger,
        completed.status,
        completed.startedAt,
      );
  }
}
