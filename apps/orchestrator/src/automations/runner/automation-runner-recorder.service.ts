import { Injectable, Logger } from '@nestjs/common';
import { waitForOperation } from '../../common/wait-for-operation';
import type { AutomationCommandOutcome } from '@rebroid/automation-core/command-registry';
import type { AutomationCommandResult } from '../commands/automation-command.types';
import { AutomationRun } from '../entities/automation-run.entity';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import type { AutomationRunEventInput } from '../events/automation-run-events.types';
import {
  buildControlStepOutput,
  buildFailedStepResult,
  buildStepOutput,
  buildSuccessfulStepResult,
  type StepResultOptions,
} from './automation-runner-results';
import { AutomationStepResult } from './automation-runner.types';
import type { AutomationOcrExchangeRecorder } from '../vision/automation-ocr.port';
import {
  createOcrExchange,
  createOcrInputPreview,
} from './automation-ocr-exchange';

const maxPendingOcrExchanges = 4;
const maxOcrExchangesPerStep = 128;

interface StepRecorderState {
  outputsByStepId: Map<string, Record<string, unknown> | null>;
}

type StepOccurrence = Omit<StepResultOptions, 'completedAt'>;

@Injectable()
export class AutomationRunnerRecorderService {
  private readonly logger = new Logger(AutomationRunnerRecorderService.name);

  constructor(private readonly events: AutomationRunEventBus) {}

  ocrExchangeRecorder(
    run: AutomationRun,
    step: StepOccurrence,
    signal?: AbortSignal,
  ) {
    let pending = Promise.resolve();
    let queued = 0;
    const exchanges: AutomationRunEventInput[] = [];
    const warn = () => {
      this.logger.warn(
        `Could not record OCR exchange for workflow run ${run.id}.`,
      );
    };
    const record: AutomationOcrExchangeRecorder = (result, trace, image) => {
      if (
        signal?.aborted ||
        queued >= maxPendingOcrExchanges ||
        exchanges.length + queued >= maxOcrExchangesPerStep
      )
        return;
      queued++;
      pending = pending
        .then(async () => {
          if (signal?.aborted) return;
          const { request, response } = createOcrExchange(result, trace, image);
          const preview = await createOcrInputPreview(image);
          if (signal?.aborted) return;
          let message = 'OCR request failed.';
          if (response.status === 'canceled') message = 'OCR request canceled.';
          if (response.status === 'available') {
            message = `OCR returned ${response.detectionCount} text box(es).`;
          }
          exchanges.push({
            runId: run.id,
            ownerUserId: run.ownerUserId,
            type: 'vision.ocr.exchange',
            stepId: step.stepId,
            parentStepId: step.parentStepId ?? null,
            message,
            data: { path: step.path, request, response, preview },
          });
        })
        .catch(warn)
        .finally(() => {
          queued--;
        });
    };
    const publish = async () => {
      await pending;
      for (const exchange of exchanges.splice(0)) {
        if (signal?.aborted) break;
        try {
          if (!(await this.events.emitWhileRunning(exchange))) break;
        } catch {
          warn();
        }
      }
    };
    return {
      record,
      // Perception events share the same writer. Publish OCR exchanges only after the command settles.
      flush: () => {
        const writing = publish();
        return signal
          ? waitForOperation(writing, signal).catch(() => undefined)
          : writing;
      },
    };
  }

  async recordActionStarted(run: AutomationRun, step: StepOccurrence) {
    await this.events.emit({
      runId: run.id,
      ownerUserId: run.ownerUserId,
      type: 'step.started',
      stepId: step.stepId,
      parentStepId: step.parentStepId ?? null,
      message: `Starting ${step.uses}.`,
      data: { uses: step.uses, path: step.path },
    });
  }

  async recordActionCompleted(
    run: AutomationRun,
    state: StepRecorderState,
    step: StepOccurrence,
    result: AutomationCommandResult,
  ) {
    const completedAt = new Date().toISOString();
    const output = buildStepOutput(result);
    return this.recordOutcome(
      run,
      state,
      buildSuccessfulStepResult({ ...step, completedAt }, output),
      result.summary,
    );
  }

  recordRepeatStarted(run: AutomationRun, step: StepOccurrence) {
    return this.events.emitWhileRunning({
      runId: run.id,
      ownerUserId: run.ownerUserId,
      type: 'step.started',
      stepId: step.stepId,
      parentStepId: step.parentStepId ?? null,
      message: 'Starting repeat.',
      data: { uses: step.uses, path: step.path },
    });
  }

  async recordStepFailed(
    run: AutomationRun,
    state: StepRecorderState,
    step: StepOccurrence,
    message: string,
    outcome?: AutomationCommandOutcome,
  ) {
    return this.recordOutcome(
      run,
      state,
      buildFailedStepResult(
        {
          ...step,
          completedAt: new Date().toISOString(),
        },
        message,
        outcome,
      ),
      message,
    );
  }

  async recordControlCompleted(
    run: AutomationRun,
    state: StepRecorderState,
    step: StepOccurrence,
    output: Record<string, unknown>,
  ) {
    const completedAt = new Date().toISOString();
    const result = buildControlStepOutput(step.uses, output);
    return this.recordOutcome(
      run,
      state,
      buildSuccessfulStepResult({ ...step, completedAt }, result),
      result.summary,
    );
  }

  private async recordOutcome(
    run: AutomationRun,
    state: StepRecorderState,
    result: AutomationStepResult,
    message: string,
  ) {
    const saved = await this.events.recordStepOutcome(
      {
        runId: run.id,
        ownerUserId: run.ownerUserId,
        type: result.status === 'failed' ? 'step.failed' : 'step.completed',
        stepId: result.stepId,
        parentStepId: result.parentStepId,
        message,
        data: result.output
          ? { uses: result.uses, output: result.output }
          : { uses: result.uses },
      },
      result,
    );
    if (saved) {
      run.error = result.error;
      state.outputsByStepId.set(result.stepId, result.output);
    }
    return saved;
  }
}
