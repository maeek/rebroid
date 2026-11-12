import { Injectable, Logger } from '@nestjs/common';
import type { AutomationCommandOutcome } from '@rebroid/automation-core/command-registry';
import type { AutomationCommandResult } from '../commands/automation-command.types';
import { AutomationRun } from '../entities/automation-run.entity';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import {
  buildControlStepOutput,
  buildFailedStepResult,
  buildStepOutput,
  buildSuccessfulStepResult,
} from './automation-runner-results';
import { AutomationStepResult } from './automation-runner.types';
import type { AutomationOcrExchangeRecorder } from '../vision/automation-ocr-exchange';

interface StepRecorderState {
  runId: string;
  outputsByStepId: Map<string, Record<string, unknown> | null>;
}

interface StepRecorderOptions {
  parentStepId?: string | null;
  path: string;
}

@Injectable()
export class AutomationRunnerRecorderService {
  private readonly logger = new Logger(AutomationRunnerRecorderService.name);

  constructor(private readonly events: AutomationRunEventBus) {}

  ocrExchangeRecorder(
    run: AutomationRun,
    stepId: string,
    options: StepRecorderOptions,
  ): AutomationOcrExchangeRecorder {
    return async ({ request, response }, preview) => {
      let message = 'OCR request failed.';
      if (response.status === 'canceled') message = 'OCR request canceled.';
      if (response.status === 'available') {
        message = `OCR returned ${response.detectionCount} text box(es).`;
      }
      try {
        await this.events.emit({
          runId: run.id,
          ownerUserId: run.ownerUserId,
          type: 'vision.ocr.exchange',
          stepId,
          parentStepId: options.parentStepId ?? null,
          message,
          data: { path: options.path, request, response, preview },
        });
      } catch {
        this.logger.warn(
          `Could not record OCR exchange for workflow run ${run.id}.`,
        );
      }
    };
  }

  async recordActionStarted(
    run: AutomationRun,
    state: Pick<StepRecorderState, 'runId'>,
    stepId: string,
    uses: string,
    options: StepRecorderOptions,
  ) {
    await this.events.emit({
      runId: state.runId,
      ownerUserId: run.ownerUserId,
      type: 'step.started',
      stepId,
      parentStepId: options.parentStepId ?? null,
      message: `Starting ${uses}.`,
      data: { uses, path: options.path },
    });
  }

  async recordActionCompleted(
    run: AutomationRun,
    state: StepRecorderState,
    stepId: string,
    uses: string,
    options: StepRecorderOptions,
    startedAt: string,
    result: AutomationCommandResult,
  ) {
    const completedAt = new Date().toISOString();
    const output = buildStepOutput(result);
    return this.recordOutcome(
      run,
      state,
      buildSuccessfulStepResult(
        { stepId, uses, ...options, startedAt, completedAt },
        output,
      ),
      result.summary,
    );
  }

  recordRepeatStarted(
    run: AutomationRun,
    stepId: string,
    options: StepRecorderOptions,
  ) {
    return this.events.emitWhileRunning({
      runId: run.id,
      ownerUserId: run.ownerUserId,
      type: 'step.started',
      stepId,
      parentStepId: options.parentStepId ?? null,
      message: 'Starting repeat.',
      data: { uses: 'flow.repeat', path: options.path },
    });
  }

  async recordStepFailed(
    run: AutomationRun,
    state: StepRecorderState,
    stepId: string,
    uses: string,
    options: StepRecorderOptions,
    startedAt: string,
    message: string,
    outcome?: AutomationCommandOutcome,
  ) {
    return this.recordOutcome(
      run,
      state,
      buildFailedStepResult(
        {
          stepId,
          uses,
          ...options,
          startedAt,
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
    stepId: string,
    uses: string,
    options: StepRecorderOptions,
    output: Record<string, unknown>,
    startedAt = new Date().toISOString(),
  ) {
    const completedAt = new Date().toISOString();
    const result = buildControlStepOutput(uses, output);
    return this.recordOutcome(
      run,
      state,
      buildSuccessfulStepResult(
        { stepId, uses, ...options, startedAt, completedAt },
        result,
      ),
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
