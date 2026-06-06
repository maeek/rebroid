import { Injectable } from '@nestjs/common';
import { AutomationRun } from '../entities/automation-run.entity';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import {
  buildControlStepOutput,
  buildFailedStepResult,
  buildStepOutput,
  buildSuccessfulStepResult,
} from './automation-runner-results';
import { AutomationStepResult } from './automation-runner.types';

interface StepRecorderState {
  runId: string;
  results: AutomationStepResult[];
  outputsByStepId: Map<string, Record<string, unknown> | null>;
}

interface StepRecorderOptions {
  parentStepId?: string | null;
  path: string;
}

@Injectable()
export class AutomationRunnerRecorderService {
  constructor(
    private readonly runs: AutomationRunsRepository,
    private readonly events: AutomationRunEventBus,
  ) {}

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
    result: { summary: string; data?: Record<string, unknown> },
  ) {
    const completedAt = new Date().toISOString();
    const output = buildStepOutput(result.summary, result.data);
    state.outputsByStepId.set(stepId, output);
    state.results.push(
      buildSuccessfulStepResult(
        {
          stepId,
          uses,
          parentStepId: options.parentStepId ?? null,
          path: options.path,
          startedAt,
          completedAt,
        },
        output,
      ),
    );
    await this.saveRunResults(run, state.results);
    await this.events.emit({
      runId: state.runId,
      ownerUserId: run.ownerUserId,
      type: 'step.completed',
      stepId,
      parentStepId: options.parentStepId ?? null,
      message: result.summary,
      data: { uses, output },
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
    emitEvent: boolean,
  ) {
    const completedAt = new Date().toISOString();
    state.outputsByStepId.set(stepId, null);
    state.results.push(
      buildFailedStepResult(
        {
          stepId,
          uses,
          parentStepId: options.parentStepId ?? null,
          path: options.path,
          startedAt,
          completedAt,
        },
        message,
      ),
    );
    run.error = message;
    await this.saveRunResults(run, state.results);
    if (!emitEvent) {
      return;
    }
    await this.events.emit({
      runId: state.runId,
      ownerUserId: run.ownerUserId,
      type: 'step.failed',
      stepId,
      parentStepId: options.parentStepId ?? null,
      message,
      data: { uses },
    });
  }

  async recordControlCompleted(
    run: AutomationRun,
    state: StepRecorderState,
    stepId: string,
    uses: string,
    options: StepRecorderOptions,
    output: Record<string, unknown>,
  ) {
    const now = new Date().toISOString();
    const result = buildControlStepOutput(uses, output);
    state.outputsByStepId.set(stepId, result);
    state.results.push(
      buildSuccessfulStepResult(
        {
          stepId,
          uses,
          parentStepId: options.parentStepId ?? null,
          path: options.path,
          startedAt: now,
          completedAt: now,
        },
        result,
      ),
    );
    await this.saveRunResults(run, state.results);
    await this.events.emit({
      runId: state.runId,
      ownerUserId: run.ownerUserId,
      type: 'step.completed',
      stepId,
      parentStepId: options.parentStepId ?? null,
      message: result.summary,
      data: { uses, output: result },
    });
  }

  async saveRunResults(run: AutomationRun, results: AutomationStepResult[]) {
    run.stepResultsJson = JSON.stringify(results);
    await this.runs.save(run);
  }
}
