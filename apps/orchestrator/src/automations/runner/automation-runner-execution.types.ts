import type { AndroidAutomationApplication } from '../../android-apps/contracts/android-apps-automation.port';
import { AutomationRunTrigger } from '../entities/automation-run.entity';
import type { AdmitAutomationTargetWork } from './automation-runner-options';

export interface AutomationExecutionState {
  app: AndroidAutomationApplication;
  canUseInternet: boolean;
  defaultAiCapabilities?: string[];
  runId: string;
  trigger: AutomationRunTrigger;
  targetProfileMode: string | null;
  targetProfileName: string | null;
  outputsByStepId: Map<string, Record<string, unknown> | null>;
}

export interface AutomationStepExecutionOptions {
  abortSignal?: AbortSignal;
  parentStepId?: string | null;
  path: string;
  isRunCanceled: (runId: string) => boolean;
  admitTargetWork: AdmitAutomationTargetWork;
}

export interface AutomationStepExecutionResult {
  failed: boolean;
  stopped: boolean;
}
