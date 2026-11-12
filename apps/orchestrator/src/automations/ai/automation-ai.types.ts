import type {
  AutomationCommandContext,
  AutomationCommandExecutor,
  AutomationTargetExecutor,
} from '../commands/automation-command.types';

export interface AutomationAiHarnessContext extends Pick<
  AutomationCommandContext,
  'app' | 'adb' | 'abortSignal' | 'parentStepId' | 'recordOcrExchange'
> {
  runId: string;
  ownerUserId: string;
  stepId: string;
  executeCommand: AutomationCommandExecutor;
  withTarget: AutomationTargetExecutor;
}
