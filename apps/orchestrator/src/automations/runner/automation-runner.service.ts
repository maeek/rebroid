import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
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
  AdmitAutomationTargetWork,
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
  pendingTargetWork: Set<Promise<unknown>>;
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
    private readonly features: FeatureFlagsService,
  ) {}

  async onApplicationBootstrap() {
    const message = 'Automation stopped because the orchestrator restarted.';
    for (const run of await this.runs.listAllActive()) {
      await this.events.transitionRun(
        run.id,
        [AutomationRunStatus.Queued, AutomationRunStatus.Running],
        {
          status: AutomationRunStatus.Failed,
          completedAt: new Date(),
          error: message,
        },
        { type: 'run.failed', message },
      );
    }
  }

  enqueue(
    automation: Automation,
    trigger: AutomationRunTrigger,
    options: AutomationRunTargetOptions = {},
  ) {
    this.features.assertEnabled('feature.workflows');
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
    userMessage?: { prompt: string; clientMessageId?: string },
  ) {
    this.features.assertEnabled('feature.ai');
    return this.enqueueRunnable(
      this.ephemeralAutomations.create(ownerUserId, definition),
      trigger,
      options,
      userMessage,
    );
  }

  private async enqueueRunnable(
    runnable: RunnableAutomation,
    trigger: AutomationRunTrigger,
    options: AutomationRunTargetOptions,
    userMessage?: { prompt: string; clientMessageId?: string },
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
      if (userMessage) {
        await this.events.emit({
          runId: run.id,
          ownerUserId: run.ownerUserId,
          type: 'ai.user.message',
          message: userMessage.prompt,
          data: { clientMessageId: userMessage.clientMessageId ?? null },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.events.transitionRun(
        run.id,
        [AutomationRunStatus.Queued],
        {
          status: AutomationRunStatus.Failed,
          completedAt: new Date(),
          error: message,
        },
        { type: 'run.failed', message },
      );
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
      // Keep the run's reservation while admitted Android operations settle.
      await Promise.allSettled(active.pendingTargetWork);
      const canceled = await this.events.transitionRun(
        run.id,
        [AutomationRunStatus.Queued, AutomationRunStatus.Running],
        {
          status: AutomationRunStatus.Canceled,
          completedAt: new Date(),
          error: 'Canceled by user.',
        },
        { type: 'run.canceled', message: 'Automation canceled.' },
      );
      if (!canceled) {
        return (await this.runs.findByOwnerAndId(ownerUserId, runId)) ?? run;
      }
      this.metrics.automationRunFinished(
        canceled.trigger,
        canceled.status,
        canceled.startedAt,
      );
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
    const admitTargetWork: AdmitAutomationTargetWork = async (operation) => {
      const pending = Promise.resolve().then(() => {
        abortSignal.throwIfAborted();
        return operation();
      });
      active.pendingTargetWork.add(pending);
      try {
        return await pending;
      } finally {
        active.pendingTargetWork.delete(pending);
      }
    };
    void this.execution
      .execute({
        runId,
        automationId,
        targetOptions,
        abortSignal,
        admitTargetWork,
        admitTargetStart: async (start) => {
          await admitTargetWork(start);
        },
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

    const active: ActiveRun = {
      abortController: new AbortController(),
      pendingTargetWork: new Set(),
    };
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
