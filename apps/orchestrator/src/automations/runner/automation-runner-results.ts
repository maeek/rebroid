import { AutomationStepResult } from './automation-runner.types';
import type { AutomationCommandOutcome } from '@rebroid/automation-core/command-registry';
import type { AutomationCommandResult } from '../commands/automation-command.types';

export interface StepResultOptions {
  stepId: string;
  uses: string;
  parentStepId?: string | null;
  path: string;
  startedAt: string;
  completedAt: string;
}

export const buildStepOutput = (result: AutomationCommandResult) => ({
  ...result.data,
  summary: result.summary,
  commandOutcome: result.outcome ?? 'succeeded',
});

export const buildSuccessfulStepResult = (
  options: StepResultOptions,
  output: Record<string, unknown>,
): AutomationStepResult => ({
  stepId: options.stepId,
  uses: options.uses,
  parentStepId: options.parentStepId ?? null,
  path: options.path,
  status: 'success',
  startedAt: options.startedAt,
  completedAt: options.completedAt,
  output,
  error: null,
});

export const buildFailedStepResult = (
  options: StepResultOptions,
  error: string,
  outcome?: AutomationCommandOutcome,
): AutomationStepResult => ({
  stepId: options.stepId,
  uses: options.uses,
  parentStepId: options.parentStepId ?? null,
  path: options.path,
  status: 'failed',
  startedAt: options.startedAt,
  completedAt: options.completedAt,
  output: outcome ? { summary: error, commandOutcome: outcome } : null,
  error,
});

export const buildControlStepOutput = (
  uses: string,
  output: Record<string, unknown>,
) => ({
  summary: output.branch ? String(output.branch) : uses,
  ...output,
});
