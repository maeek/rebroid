import type { AndroidAutomationApplication } from '../../android-apps/contracts/android-apps-automation.port';
import { AutomationRunTrigger } from '../entities/automation-run.entity';
import { AutomationStepResult } from './automation-runner.types';

export interface AutomationExecutionState {
  app: AndroidAutomationApplication;
  runId: string;
  trigger: AutomationRunTrigger;
  targetProfileMode: string | null;
  targetProfileName: string | null;
  results: AutomationStepResult[];
  outputsByStepId: Map<string, Record<string, unknown> | null>;
}

export interface AutomationStepExecutionOptions {
  abortSignal?: AbortSignal;
  parentStepId?: string | null;
  path: string;
  isRunCanceled: (runId: string) => boolean;
}

export interface AutomationStepExecutionResult {
  failed: boolean;
  stopped: boolean;
}
