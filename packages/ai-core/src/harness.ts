import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
  AutomationAiRunInput,
} from "./provider";

export interface AutomationCommandLike {
  uses: string;
  label: string;
  description: string;
  inputSchema: unknown;
}

export interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
}

export const toolName = (uses: string) => uses.replace(/[^a-zA-Z0-9_]/g, "__");

export const allowedToolMatcher = (allowedTools?: string[]) => {
  const allowed = new Set((allowedTools ?? []).filter(Boolean));
  return (uses: string) => allowed.size === 0 || allowed.has(uses);
};

export const buildToolDefinitions = (
  commands: AutomationCommandLike[],
  allowed: (uses: string) => boolean,
) =>
  commands
    .filter((command) => command.uses !== "ai.run" && allowed(command.uses))
    .map((command) => ({
      type: "function" as const,
      function: {
        name: toolName(command.uses),
        description: `${command.label}. ${command.description}`,
        parameters: command.inputSchema,
      },
    }));

export const mapUsesByToolName = (
  commands: Pick<AutomationCommandLike, "uses">[],
) => new Map(commands.map((command) => [toolName(command.uses), command.uses]));

export const buildInitialMessages = (
  input: Pick<AutomationAiRunInput, "prompt">,
  model: AutomationAiProviderModel,
): ChatMessage[] => [
  {
    role: "system",
    content: [
      "You are controlling an Android automation through typed tools. Use tools only when needed, keep progress concise, and finish with a short visible summary. Never invent tool results.",
      model.settings.systemPrompt,
    ]
      .filter(Boolean)
      .join("\n\n"),
  },
  { role: "user", content: input.prompt },
];

export const chatCompletionsEndpoint = (provider: AutomationAiProvider) =>
  provider.kind === "ollama"
    ? `${provider.baseUrl.replace(/\/+$/, "")}/v1/chat/completions`
    : `${provider.baseUrl.replace(/\/+$/, "")}/chat/completions`;

export const buildChatRequestBody = ({
  messages,
  model,
  provider,
  tools,
}: {
  messages: ChatMessage[];
  model: AutomationAiProviderModel;
  provider: AutomationAiProvider;
  tools: unknown[];
}) => ({
  model: model.id,
  messages,
  tools,
  tool_choice: "auto",
  temperature: model.settings.temperature ?? 0.2,
  ...(model.settings.topP !== null && model.settings.topP !== undefined
    ? { top_p: model.settings.topP }
    : {}),
  ...(provider.kind === "ollama"
    ? {
        options: ollamaOptions(model),
        ...(model.settings.keepAlive
          ? { keep_alive: model.settings.keepAlive }
          : {}),
      }
    : {}),
});

export const parseArguments = (value: string) => {
  try {
    const parsed = JSON.parse(value || "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

export const ollamaOptions = (model: AutomationAiProviderModel) =>
  Object.fromEntries(
    [
      ["num_ctx", model.settings.numCtx],
      ["repeat_penalty", model.settings.repeatPenalty],
      ["seed", model.settings.seed],
      ["top_k", model.settings.topK],
    ].filter(([, value]) => value !== null && value !== undefined),
  );
