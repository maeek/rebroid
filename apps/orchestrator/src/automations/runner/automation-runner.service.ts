import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AndroidAppsStateService } from '../../android-apps/common/services/android-apps-state.service';
import { Automation } from '../entities/automation.entity';
import {
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationDefinition } from '@rebroid/automation-core/definition';
import { AutomationStepResult } from './automation-runner.types';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationRunnerTargetService } from './automation-runner-target.service';
import { AutomationRunTargetOptions } from './automation-runner-options';
import { RunnableAutomation } from './automation-runnable';
import { AutomationRunFinalizerService } from './automation-run-finalizer.service';
import { AutomationRunnableResolverService } from './automation-runnable-resolver.service';
import { EphemeralAutomationRegistryService } from './ephemeral-automation-registry.service';
import { AutomationExecutionState } from './automation-runner-execution.types';
import { AutomationStepExecutorService } from './automation-step-executor.service';

const terminalStatuses = new Set<AutomationRunStatus>([
  AutomationRunStatus.Success,
  AutomationRunStatus.Failed,
  AutomationRunStatus.Canceled,
]);

@Injectable()
export class AutomationRunnerService {
  private readonly canceledRunIds = new Set<string>();
  private readonly activeRunAbortControllers = new Map<
    string,
    AbortController
  >();

  constructor(
    private readonly runs: AutomationRunsRepository,
    private readonly apps: AndroidAppsStateService,
    private readonly events: AutomationRunEventBus,
    private readonly targets: AutomationRunnerTargetService,
    private readonly ephemeralAutomations: EphemeralAutomationRegistryService,
    private readonly runnableResolver: AutomationRunnableResolverService,
    private readonly runFinalizer: AutomationRunFinalizerService,
    private readonly stepExecutor: AutomationStepExecutorService,
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
    return this.enqueueRunnable(
      this.ephemeralAutomations.create(ownerUserId, definition),
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

    const target = await this.targets.prepareTarget(resolvedTarget, options);

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

  async execute(runId: string, automationId: string) {
    const runnable = await this.runnableResolver.resolve(automationId);
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
      definition.spec.steps,
      state,
      run,
      {
        path: 'steps',
        abortSignal: abortController.signal,
        isRunCanceled: (id) => this.canceledRunIds.has(id),
      },
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

    await this.runFinalizer.updatePersistedAutomationAfterRun(
      automation,
      run,
      failed,
    );
  }
}
