export type AutomationAiProviderKind =
  | "openai"
  | "openai-compatible"
  | "ollama";

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
  settings: AutomationAiProviderModelSettings;
  supportsVision: boolean;
  supportsTools: boolean;
  enabled: boolean;
  default: boolean;
}

export interface AutomationAiProviderModelSettings {
  systemPrompt?: string | null;
  temperature?: number | null;
  topP?: number | null;
  topK?: number | null;
  numCtx?: number | null;
  repeatPenalty?: number | null;
  seed?: number | null;
  keepAlive?: string | null;
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

export type ProviderFormState = AutomationAiProvider;

export type ProviderModelRow = AutomationAiProviderModel & {
  rowId: string;
  index: number;
};

export class AiProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderConfigurationError";
  }
}
