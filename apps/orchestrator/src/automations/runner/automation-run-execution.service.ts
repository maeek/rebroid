import { Inject, Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
import {
  ANDROID_APPS_AUTOMATION,
  type AndroidAppsAutomationPort,
} from '../../android-apps/contracts/android-apps-automation.port';
import {
  AutomationRun,
  AutomationRunStatus,
} from '../entities/automation-run.entity';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationRunFinalizerService } from './automation-run-finalizer.service';
import { AutomationRunnableResolverService } from './automation-runnable-resolver.service';
import { AutomationExecutionState } from './automation-runner-execution.types';
import { AutomationStepExecutorService } from './automation-step-executor.service';
import { AutomationStepResult } from './automation-runner.types';
import { EphemeralAutomationRegistryService } from './ephemeral-automation-registry.service';
import { MetricsService } from '../../metrics/metrics.service';
import { AutomationRunnerTargetService } from './automation-runner-target.service';
import type { AutomationRunTargetOptions } from './automation-runner-options';

interface AutomationRunExecutionInput {
  runId: string;
  automationId: string;
  abortSignal: AbortSignal;
  targetOptions: AutomationRunTargetOptions;
}

@Injectable()
export class AutomationRunExecutionService {
  private readonly logger = new Logger(AutomationRunExecutionService.name);

  constructor(
    private readonly runs: AutomationRunsRepository,
    @Inject(ANDROID_APPS_AUTOMATION)
    private readonly apps: AndroidAppsAutomationPort,
    private readonly events: AutomationRunEventBus,
    private readonly runnableResolver: AutomationRunnableResolverService,
    private readonly runFinalizer: AutomationRunFinalizerService,
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
      if (!queuedRun) return;
      if (!runnable) {
        await this.failActiveRun(
          queuedRun.id,
          queuedRun.ownerUserId,
          'Automation definition is no longer available.',
        );
        return;
      }

      const target = await this.targets.prepareTarget(
        queuedRun.targetApplicationId,
        input.targetOptions,
      );
      const prepared = await this.runs.transition(
        queuedRun.id,
        [AutomationRunStatus.Queued],
        {
          targetProfileMode: target.profileMode,
          targetProfileName: target.profileName,
        },
      );
      if (!prepared) return;

      const run = await this.runs.transition(
        prepared.id,
        [AutomationRunStatus.Queued],
        {
          status: AutomationRunStatus.Running,
          startedAt: new Date(),
          stepResultsJson: '[]',
          error: null,
        },
      );
      if (!run) return;
      this.metrics.automationRunStarted();

      await this.events.emit({
        runId: run.id,
        ownerUserId: run.ownerUserId,
        type: 'run.started',
        message: 'Automation started.',
        data: { automationId: runnable.entity.id },
      });

      const app = await this.apps.get(run.targetApplicationId);
      const results: AutomationStepResult[] = [];
      const state: AutomationExecutionState = {
        app,
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
      const completed = await this.runs.transition(
        run.id,
        [AutomationRunStatus.Running],
        {
          status,
          completedAt: new Date(),
          stepResultsJson: JSON.stringify(results),
          error: failed ? run.error : null,
        },
      );
      if (!completed) return;

      this.metrics.automationRunFinished(
        completed.trigger,
        completed.status,
        completed.startedAt,
      );
      await this.emitTerminalEvent(completed);
      if (!runnable.ephemeral) {
        await this.runFinalizer.updatePersistedAutomationAfterRun(
          runnable.entity,
          completed,
          failed || status === AutomationRunStatus.Canceled,
        );
      }
    } catch (error) {
      const run = await this.runs.findById(input.runId);
      if (run) {
        const failed = await this.failActiveRun(
          run.id,
          run.ownerUserId,
          getErrorMessage(error),
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
    ownerUserId: string,
    message: string,
  ) {
    const failed = await this.runs.transition(
      runId,
      [AutomationRunStatus.Queued, AutomationRunStatus.Running],
      {
        status: AutomationRunStatus.Failed,
        completedAt: new Date(),
        error: message,
      },
    );
    if (!failed) return null;
    await this.events.emit({
      runId,
      ownerUserId,
      type: 'run.failed',
      message,
    });
    return failed;
  }

  private emitTerminalEvent(run: AutomationRun) {
    const canceled = run.status === AutomationRunStatus.Canceled;
    const failed = run.status === AutomationRunStatus.Failed;
    return this.events.emit({
      runId: run.id,
      ownerUserId: run.ownerUserId,
      type: canceled ? 'run.canceled' : failed ? 'run.failed' : 'run.completed',
      message: canceled
        ? 'Automation canceled.'
        : failed
          ? (run.error ?? 'Automation failed.')
          : 'Automation completed.',
    });
  }
}
