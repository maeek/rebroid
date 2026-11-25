import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { Automation } from '../entities/automation.entity';
import {
  AutomationRunStatus,
  AutomationRunTrigger,
  type AutomationRun,
} from '../entities/automation-run.entity';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationRunTargetConflictError } from '../persistence/automation-run-events.repository';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationRunExecutionService } from './automation-run-execution.service';
import type {
  AdmitAutomationTargetWork,
  AutomationRunTargetOptions,
} from './automation-runner-options';
import { AutomationRunStartPolicy } from './automation-runner-options';
import { EphemeralAutomationRegistryService } from './ephemeral-automation-registry.service';
import { RunnableAutomation } from './automation-runnable';
import { AutomationDefinition } from '@rebroid/automation-core/definition';
import { MetricsService } from '../../metrics/metrics.service';
import { getErrorMessage } from '../../common/error-message';
import {
  ANDROID_APPS_AUTOMATION,
  type AndroidAppsAutomationPort,
} from '../../android-apps/contracts/android-apps-automation.port';
import { externalDefinitionIssue } from '@rebroid/automation-core/device-capabilities';

const terminalStatuses = new Set<AutomationRunStatus>([
  AutomationRunStatus.Success,
  AutomationRunStatus.Failed,
  AutomationRunStatus.Canceled,
]);
const cancellationWriteRetryDelaysMs = [50, 250];
const cancellationRecoveryInitialDelayMs = 1_000;
const cancellationRecoveryMaxDelayMs = 30_000;

type ActiveRun = {
  abortController: AbortController;
  pendingTargetWork: Set<Promise<unknown>>;
};

@Injectable()
export class AutomationRunnerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(AutomationRunnerService.name);
  private readonly activeRuns = new Map<string, ActiveRun>();
  private readonly pendingCancellations = new Map<
    string,
    Promise<AutomationRun | null>
  >();
  private readonly shutdown = new AbortController();

  constructor(
    private readonly runs: AutomationRunsRepository,
    private readonly events: AutomationRunEventBus,
    private readonly ephemeralAutomations: EphemeralAutomationRegistryService,
    private readonly execution: AutomationRunExecutionService,
    private readonly metrics: MetricsService,
    private readonly features: FeatureFlagsService,
    @Optional()
    @Inject(ANDROID_APPS_AUTOMATION)
    private readonly devices?: AndroidAppsAutomationPort,
  ) {}

  async onApplicationBootstrap() {
    const message = 'Automation stopped because the orchestrator restarted.';
    for (const run of await this.runs.listAllActive()) {
      await this.events.transitionRun(run.id, {
        status: AutomationRunStatus.Failed,
        completedAt: new Date(),
        error: message,
      });
    }
  }

  onModuleDestroy() {
    this.shutdown.abort();
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
    const targetDeviceId = options.targetDeviceId;
    if (!targetDeviceId) {
      if (runnable.ephemeral)
        this.ephemeralAutomations.delete(runnable.entity.id);
      throw new ConflictException(
        'A target device is required to run an automation.',
      );
    }

    let run;
    try {
      const device = await this.devices?.getAutomationDevice?.(targetDeviceId);
      const isExternal = device?.kind === 'external';
      if (isExternal) {
        this.features.assertEnabled('feature.external-devices');
        if (device.ownerUserId !== runnable.entity.ownerUserId)
          throw new NotFoundException('Target device was not found.');
        const issue = externalDefinitionIssue(runnable.definition);
        if (issue) throw new BadRequestException(issue);
        if (
          options.targetProfileName ||
          options.targetProfileMode ||
          options.startPolicy === AutomationRunStartPolicy.StartIfNeeded
        ) {
          throw new BadRequestException(
            'External devices require a verified connection and do not accept startup or profile options.',
          );
        }
      }
      run = await this.events.enqueueRun(
        {
          automationId: runnable.entity.id,
          automationTriggerId: options.automationTriggerId ?? null,
          ownerUserId: runnable.entity.ownerUserId,
          targetDeviceId,
          ...(isExternal && { targetKind: 'external' as const }),
          ...(isExternal &&
            options.targetAttachmentId && {
              targetAttachmentId: options.targetAttachmentId,
            }),
          targetProfileMode: options.targetProfileMode ?? null,
          targetProfileName: options.targetProfileName ?? null,
          trigger,
        },
        userMessage,
      );
    } catch (error) {
      if (runnable.ephemeral) {
        this.ephemeralAutomations.delete(runnable.entity.id);
      }
      if (error instanceof AutomationRunTargetConflictError) {
        throw new ConflictException(
          `An automation run is already active for target device "${targetDeviceId}".`,
        );
      }
      throw error;
    }

    this.dispatch(run.id, runnable.entity.id, options);
    return run;
  }

  async cancel(ownerUserId: string, runId: string) {
    const run = await this.runs.findMetadataByOwnerAndId(ownerUserId, runId);
    if (!run) {
      throw new NotFoundException(`Automation run "${runId}" was not found.`);
    }
    if (terminalStatuses.has(run.status)) return run;

    const canceled = await (this.pendingCancellations.get(runId) ??
      this.beginCancellation(runId));
    return (
      canceled ??
      (await this.runs.findMetadataByOwnerAndId(ownerUserId, runId)) ??
      run
    );
  }

  private beginCancellation(runId: string) {
    // A queued run can be canceled while enqueue is still publishing its event.
    const alreadyTracked = this.activeRuns.has(runId);
    const active = this.getOrCreateActiveRun(runId);
    const cancellation = Promise.resolve().then(async () => {
      active.abortController.abort();
      // Keep the run's reservation while admitted Android operations settle.
      await Promise.allSettled(active.pendingTargetWork);
      return this.persistCancellation(runId);
    });
    this.pendingCancellations.set(runId, cancellation);
    void cancellation
      .catch((error: unknown) => this.recoverCancellation(runId, error))
      .finally(() => {
        this.pendingCancellations.delete(runId);
        if (!alreadyTracked && this.activeRuns.get(runId) === active) {
          this.activeRuns.delete(runId);
        }
      });
    return cancellation;
  }

  private async persistCancellation(runId: string) {
    const { signal } = this.shutdown;
    for (const delayMs of cancellationWriteRetryDelaysMs) {
      signal.throwIfAborted();
      try {
        return await this.writeCancellation(runId);
      } catch {
        await delay(delayMs, undefined, { signal });
      }
    }
    signal.throwIfAborted();
    return this.writeCancellation(runId);
  }

  private async recoverCancellation(runId: string, error: unknown) {
    const { signal } = this.shutdown;
    if (signal.aborted) return;
    this.logger.warn(
      `Retrying cancellation write for automation run ${runId}: ${getErrorMessage(error)}`,
    );
    let delayMs = cancellationRecoveryInitialDelayMs;
    while (!signal.aborted) {
      try {
        await delay(delayMs, undefined, { signal, ref: false });
        signal.throwIfAborted();
        await this.writeCancellation(runId);
        return;
      } catch {
        delayMs = Math.min(delayMs * 2, cancellationRecoveryMaxDelayMs);
      }
    }
  }

  private async writeCancellation(runId: string) {
    const canceled = await this.events.transitionRun(runId, {
      status: AutomationRunStatus.Canceled,
      completedAt: new Date(),
      error: 'Canceled by user.',
    });
    if (canceled) {
      this.metrics.automationRunFinished(
        canceled.trigger,
        canceled.status,
        canceled.startedAt,
      );
    }
    return canceled;
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
}
