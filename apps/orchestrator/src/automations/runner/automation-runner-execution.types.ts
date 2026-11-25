import type {
  AndroidAutomationApplication,
  AndroidAutomationTarget,
} from '../../android-apps/contracts/android-apps-automation.port';
import { AutomationRunTrigger } from '../entities/automation-run.entity';
import type { AdmitAutomationTargetWork } from './automation-runner-options';

export interface AutomationExecutionState {
  app: AndroidAutomationApplication;
  readonly target: AndroidAutomationTarget;
  canUseInternet: boolean;
  defaultAiCapabilities?: string[];
  authorizeTarget?: (signal?: AbortSignal, command?: string) => Promise<void>;
  runId: string;
  trigger: AutomationRunTrigger;
  targetProfileMode: string | null;
  targetProfileName: string | null;
  outputsByStepId: Map<string, Record<string, unknown> | null>;
}

export interface AutomationStepExecutionOptions {
  abortSignal: AbortSignal;
  parentStepId?: string | null;
  path: string;
  admitTargetWork: AdmitAutomationTargetWork;
}

export interface AutomationStepExecutionResult {
  failed: boolean;
  stopped: boolean;
}
