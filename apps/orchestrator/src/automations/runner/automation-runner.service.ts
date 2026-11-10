import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Automation } from '../entities/automation.entity';
import {
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationRunExecutionService } from './automation-run-execution.service';
import type {
  AdmitAutomationTargetStart,
  AutomationRunTargetOptions,
} from './automation-runner-options';
import { EphemeralAutomationRegistryService } from './ephemeral-automation-registry.service';
import { RunnableAutomation } from './automation-runnable';
import { AutomationDefinition } from '@rebroid/automation-core/definition';
import { MetricsService } from '../../metrics/metrics.service';

const terminalStatuses = new Set<AutomationRunStatus>([
  AutomationRunStatus.Success,
  AutomationRunStatus.Failed,
  AutomationRunStatus.Canceled,
]);

type ActiveRun = {
  abortController: AbortController;
  pendingTargetStart?: Promise<void>;
};

@Injectable()
export class AutomationRunnerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AutomationRunnerService.name);
  private readonly activeRuns = new Map<string, ActiveRun>();

  constructor(
    private readonly runs: AutomationRunsRepository,
    private readonly events: AutomationRunEventBus,
    private readonly ephemeralAutomations: EphemeralAutomationRegistryService,
    private readonly execution: AutomationRunExecutionService,
    private readonly metrics: MetricsService,
  ) {}

  async onApplicationBootstrap() {
    for (const run of await this.runs.listAllActive()) {
      const failed = await this.runs.transition(
        run.id,
        [AutomationRunStatus.Queued, AutomationRunStatus.Running],
        {
          status: AutomationRunStatus.Failed,
          completedAt: new Date(),
          error: 'Automation stopped because the orchestrator restarted.',
        },
      );
      if (!failed) continue;
      await this.events.emit({
        runId: failed.id,
        ownerUserId: failed.ownerUserId,
        type: 'run.failed',
        message: failed.error ?? 'Automation stopped after restart.',
      });
    }
  }

  enqueue(
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

  enqueueEphemeral(
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
    options: AutomationRunTargetOptions,
  ) {
    const targetApplicationId = options.targetApplicationId;
    if (!targetApplicationId) {
      throw new ConflictException(
        'A target application is required to run an automation.',
      );
    }

    let run;
    try {
      run = await this.runs.save(
        this.runs.create({
          automationId: runnable.entity.id,
          automationTriggerId: options.automationTriggerId ?? null,
          ownerUserId: runnable.entity.ownerUserId,
          targetApplicationId,
          targetProfileMode: options.targetProfileMode ?? null,
          targetProfileName: options.targetProfileName ?? null,
          trigger,
          status: AutomationRunStatus.Queued,
          createdAt: new Date(),
          startedAt: null,
          completedAt: null,
          stepResultsJson: '[]',
          error: null,
          lastEventSequence: 0,
        }),
      );
    } catch (error) {
      if (runnable.ephemeral) {
        this.ephemeralAutomations.delete(runnable.entity.id);
      }
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException(
          `An automation run is already active for target application "${targetApplicationId}".`,
        );
      }
      throw error;
    }

    try {
      await this.events.emit({
        runId: run.id,
        ownerUserId: run.ownerUserId,
        type: 'run.queued',
        message: 'Automation queued.',
        data: { automationId: runnable.entity.id, trigger },
      });
    } catch (error) {
      await this.runs.transition(run.id, [AutomationRunStatus.Queued], {
        status: AutomationRunStatus.Failed,
        completedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
      });
      this.metrics.automationRunFinished(
        trigger,
        AutomationRunStatus.Failed,
        null,
      );
      if (runnable.ephemeral) {
        this.ephemeralAutomations.delete(runnable.entity.id);
      }
      throw error;
    }

    this.dispatch(run.id, runnable.entity.id, options);
    return run;
  }

  async cancel(ownerUserId: string, runId: string) {
    const run = await this.runs.findByOwnerAndId(ownerUserId, runId);
    if (!run) {
      throw new NotFoundException(`Automation run "${runId}" was not found.`);
    }
    if (terminalStatuses.has(run.status)) return run;

    // A queued run can be canceled while enqueue is still publishing its event.
    const alreadyTracked = this.activeRuns.has(run.id);
    const active = this.getOrCreateActiveRun(run.id);
    try {
      active.abortController.abort();
      if (active.pendingTargetStart) {
        // Keep the run's reservation until Android has finished admitting the start.
        await active.pendingTargetStart.catch(() => undefined);
      }
      const canceled = await this.runs.transition(
        run.id,
        [AutomationRunStatus.Queued, AutomationRunStatus.Running],
        {
          status: AutomationRunStatus.Canceled,
          completedAt: new Date(),
          error: 'Canceled by user.',
        },
      );
      if (!canceled) {
        return (await this.runs.findByOwnerAndId(ownerUserId, runId)) ?? run;
      }
      this.metrics.automationRunFinished(
        canceled.trigger,
        canceled.status,
        canceled.startedAt,
      );
      await this.events.emit({
        runId: canceled.id,
        ownerUserId: canceled.ownerUserId,
        type: 'run.canceled',
        message: 'Automation canceled.',
      });
      return canceled;
    } finally {
      if (!alreadyTracked && this.activeRuns.get(run.id) === active) {
        this.activeRuns.delete(run.id);
      }
    }
  }

  private dispatch(
    runId: string,
    automationId: string,
    targetOptions: AutomationRunTargetOptions,
  ) {
    const active = this.getOrCreateActiveRun(runId);
    const abortSignal = active.abortController.signal;
    const admitTargetStart: AdmitAutomationTargetStart = async (start) => {
      const pending = Promise.resolve().then(async () => {
        abortSignal.throwIfAborted();
        await start();
      });
      active.pendingTargetStart = pending;
      try {
        await pending;
      } finally {
        active.pendingTargetStart = undefined;
      }
    };
    void this.execution
      .execute({
        runId,
        automationId,
        targetOptions,
        abortSignal,
        admitTargetStart,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Automation execution dispatch failed for ${runId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      })
      .finally(() => this.activeRuns.delete(runId));
  }

  private getOrCreateActiveRun(runId: string) {
    const current = this.activeRuns.get(runId);
    if (current) return current;

    const active: ActiveRun = { abortController: new AbortController() };
    this.activeRuns.set(runId, active);
    return active;
  }

  private isUniqueConstraint(error: unknown) {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { code?: unknown; message?: unknown };
    return (
      candidate.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      (typeof candidate.message === 'string' &&
        candidate.message.includes('automation_runs_active_target_unique'))
    );
  }
}
