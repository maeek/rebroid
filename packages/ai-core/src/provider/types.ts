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
  roles: AutomationAiProviderModelRole[];
  settings: AutomationAiProviderModelSettings;
  enabled: boolean;
  defaultFor: AutomationAiProviderModelRole[];
}

export type AutomationAiProviderModelRole = "planner" | "vision";

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

export interface AutomationAiProviderRemoteModel {
  id: string;
  label: string;
  family?: string;
  parameterSize?: string;
  quantizationLevel?: string;
}

export interface AutomationAiRunInput {
  prompt: string;
  conversation?: AutomationAiConversationMessage[];
  providerId?: string;
  modelId?: string;
  visionProviderId?: string;
  visionModelId?: string;
  clientMessageId?: string;
  initialScreenshotDataUrl?: string;
  maxToolCalls: number;
  timeoutMs: number;
  allowedTools?: string[];
  requireFinalAnswer: boolean;
}

export interface AutomationAiConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AutomationAiToolRequest {
  name: string;
  arguments: Record<string, unknown>;
  intent?: string;
  expectedOutcome?: string;
  envelopeValid?: boolean;
  toolCallId?: string;
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
