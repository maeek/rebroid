export interface AutomationCommandLike {
  uses: string;
  label: string;
  description: string;
  inputSchema: unknown;
}

export interface AutomationToolEnvelopeInput {
  intent: string;
  expectedOutcome: string;
  input: Record<string, unknown>;
  requiresScreenObservation?: boolean;
}

export interface AutomationToolEnvelopeResult {
  intent: string;
  expectedOutcome: string;
  input: Record<string, unknown>;
  requiresScreenObservation?: boolean;
  envelopeValid: boolean;
}

export interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatTextContentPart {
  type: "text";
  text: string;
}

export interface ChatImageUrlContentPart {
  type: "image_url";
  image_url: {
    url: string;
  };
}

export type ChatContentPart = ChatTextContentPart | ChatImageUrlContentPart;

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ChatContentPart[] | null;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
}
