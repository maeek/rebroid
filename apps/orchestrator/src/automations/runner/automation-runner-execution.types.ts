import { AndroidAppsStateService } from '../../android-apps/common/services/android-apps-state.service';
import { AutomationRunTrigger } from '../entities/automation-run.entity';
import { AutomationStepResult } from './automation-runner.types';

export interface AutomationExecutionState {
  app: Awaited<ReturnType<AndroidAppsStateService['get']>>;
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
