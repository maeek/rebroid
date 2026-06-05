import type { AutomationCommandContext } from '../commands/automation-command.types';

export type AutomationAiProviderKind =
  | 'openai'
  | 'openai-compatible'
  | 'ollama';

export interface AutomationAiProvider {
  id: string;
  label: string;
  kind: AutomationAiProviderKind;
  baseUrl: string;
  apiKey?: string | null;
  models: AutomationAiProviderModel[];
  enabled: boolean;
}

export interface AutomationAiProviderModel {
  id: string;
  label: string;
  supportsVision: boolean;
  supportsTools: boolean;
  enabled: boolean;
  default: boolean;
}

export interface AutomationAiRunInput {
  prompt: string;
  providerId?: string;
  modelId?: string;
  maxToolCalls: number;
  timeoutMs: number;
  allowedTools?: string[];
  requireFinalAnswer: boolean;
}

export interface AutomationAiToolRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface AutomationAiHarnessContext extends AutomationCommandContext {
  runId: string;
  ownerUserId: string;
  stepId: string;
  parentStepId?: string | null;
  path: string;
  toolExecutor: (
    tool: AutomationAiToolRequest,
  ) => Promise<{ summary: string; data?: Record<string, unknown> }>;
}
