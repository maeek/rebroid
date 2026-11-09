export type AutomationAiProviderKind =
  'openai' | 'openai-compatible' | 'ollama';

export type AutomationAiProviderProtocol =
  'openai-chat-completions' | 'ollama-native-chat';

export type AutomationAiProviderServerFlavor =
  'auto' | 'openai' | 'llama-cpp' | 'lemonade' | 'ollama';

export interface AutomationAiProvider {
  id: string;
  label: string;
  kind: AutomationAiProviderKind;
  protocol: AutomationAiProviderProtocol;
  serverFlavor: AutomationAiProviderServerFlavor;
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
  capabilities?: AutomationAiProviderModelCapabilities;
}

export type AutomationAiProviderModelRole = 'controller' | 'planner' | 'vision';

export interface AutomationAiProviderModelCapabilities {
  streaming?: boolean;
  structuredOutput?: boolean;
  tools?: boolean;
  vision?: boolean;
  reasoning?: boolean;
}

export type AutomationAiThinkingMode =
  'disabled' | 'bounded' | 'provider-default';

export interface AutomationAiProviderModelSettings {
  systemPrompt?: string | null;
  temperature?: number | null;
  topP?: number | null;
  topK?: number | null;
  numCtx?: number | null;
  repeatPenalty?: number | null;
  seed?: number | null;
  keepAlive?: string | null;
  thinkingMode?: AutomationAiThinkingMode | null;
  reasoningBudgetTokens?: number | null;
}

export interface AutomationAiProviderRemoteModel {
  id: string;
  label: string;
  family?: string;
  parameterSize?: string;
  quantizationLevel?: string;
  capabilities?: AutomationAiProviderModelCapabilities;
}

export type AutomationAiAgentMode = 'adaptive' | 'controller' | 'planned';
export type AutomationAiRawShellPolicy = 'deny' | 'allowlisted';

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
  maxActions?: number;
  timeoutMs: number;
  allowedTools?: string[];
  capabilities?: string[];
  agentMode?: AutomationAiAgentMode;
  rawShellPolicy?: AutomationAiRawShellPolicy;
  requireFinalAnswer: boolean;
}

export interface AutomationAiConversationMessage {
  role: 'user' | 'assistant';
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

export class AiProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiProviderConfigurationError';
  }
}
