import type { AutomationAiToolRequest } from '../../settings/contracts/ai-provider';
import type { AutomationCommandContext } from '../commands/automation-command.types';

export interface AutomationAiHarnessContext extends AutomationCommandContext {
  runId: string;
  ownerUserId: string;
  stepId: string;
  parentStepId?: string | null;
  path: string;
  clientMessageId?: string | null;
  abortSignal?: AbortSignal;
  toolExecutor: (
    tool: AutomationAiToolRequest,
  ) => Promise<{ summary: string; data?: Record<string, unknown> }>;
}
