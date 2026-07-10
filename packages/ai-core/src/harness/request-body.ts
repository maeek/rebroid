import type { ChatMessage } from "./types";
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
  AutomationAiProviderProtocol,
  AutomationAiProviderServerFlavor,
} from "../provider/types";

export interface ChatResponseFormat {
  type: "json_object" | "json_schema";
  schema?: Record<string, unknown>;
  json_schema?: {
    name: string;
    strict?: boolean;
    schema: Record<string, unknown>;
  };
}

export const providerProtocol = (
  provider: Pick<AutomationAiProvider, "protocol">,
): AutomationAiProviderProtocol =>
  provider.protocol ?? "openai-chat-completions";

export const providerServerFlavor = (
  provider: Pick<AutomationAiProvider, "kind" | "serverFlavor">,
): AutomationAiProviderServerFlavor =>
  provider.serverFlavor ?? (provider.kind === "openai" ? "openai" : "auto");

export const providerOpenAiRoot = (provider: AutomationAiProvider) => {
  const baseUrl = provider.baseUrl.replace(/\/+$/, "");
  if (/\/v1$/i.test(baseUrl)) return baseUrl;
  const flavor = providerServerFlavor(provider);
  if (
    provider.kind === "ollama" ||
    flavor === "llama-cpp" ||
    flavor === "lemonade" ||
    flavor === "ollama"
  ) {
    return `${baseUrl}/v1`;
  }
  return baseUrl;
};

export const chatCompletionsEndpoint = (provider: AutomationAiProvider) =>
  providerProtocol(provider) === "ollama-native-chat"
    ? `${provider.baseUrl.replace(/\/+$/, "")}/api/chat`
    : `${providerOpenAiRoot(provider)}/chat/completions`;

export const providerModelsEndpoint = (provider: AutomationAiProvider) =>
  providerProtocol(provider) === "ollama-native-chat"
    ? `${provider.baseUrl.replace(/\/+$/, "")}/api/tags`
    : `${providerOpenAiRoot(provider)}/models`;

export const buildChatRequestBody = ({
  messages,
  model,
  provider,
  responseFormat,
  stream = false,
  tools,
}: {
  messages: ChatMessage[];
  model: AutomationAiProviderModel;
  provider: AutomationAiProvider;
  responseFormat?: ChatResponseFormat;
  stream?: boolean;
  tools?: unknown[];
}) => {
  const hasTools = Array.isArray(tools) && tools.length > 0;
  if (providerProtocol(provider) === "ollama-native-chat") {
    return {
      model: model.id,
      messages: ollamaMessages(messages),
      ...(hasTools ? { tools } : {}),
      ...(ollamaResponseSchema(responseFormat)
        ? { format: ollamaResponseSchema(responseFormat) }
        : {}),
      stream,
      options: {
        temperature: model.settings.temperature ?? 0.2,
        ...(model.settings.topP !== null && model.settings.topP !== undefined
          ? { top_p: model.settings.topP }
          : {}),
        ...ollamaOptions(model),
      },
      ...(model.settings.keepAlive
        ? { keep_alive: model.settings.keepAlive }
        : {}),
      ...(model.settings.thinkingMode === "disabled" ? { think: false } : {}),
      ...(model.settings.thinkingMode === "bounded" ? { think: true } : {}),
    };
  }

  return {
    model: model.id,
    messages,
    ...(hasTools
      ? { tools, tool_choice: "auto", parallel_tool_calls: false }
      : {}),
    ...(responseFormat
      ? { response_format: openAiResponseFormat(responseFormat) }
      : {}),
    stream,
    temperature: model.settings.temperature ?? 0.2,
    ...(model.settings.topP !== null && model.settings.topP !== undefined
      ? { top_p: model.settings.topP }
      : {}),
    ...(model.settings.thinkingMode === "disabled"
      ? {
          reasoning_format: "deepseek",
          chat_template_kwargs: { enable_thinking: false },
        }
      : {}),
    ...(model.settings.thinkingMode === "bounded"
      ? {
          reasoning_format: "deepseek",
          reasoning_budget: model.settings.reasoningBudgetTokens ?? 512,
        }
      : {}),
  };
};

const ollamaResponseSchema = (responseFormat?: ChatResponseFormat) =>
  responseFormat?.schema ?? responseFormat?.json_schema?.schema;

const openAiResponseFormat = (responseFormat: ChatResponseFormat) => {
  if (responseFormat.type === "json_object") return { type: "json_object" };
  return {
    type: "json_schema",
    json_schema: responseFormat.json_schema ?? {
      name: "structured_response",
      strict: true,
      schema: responseFormat.schema ?? {},
    },
  };
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

const ollamaMessages = (messages: ChatMessage[]) =>
  messages.map((message) => {
    if (!Array.isArray(message.content)) return message;
    const text = message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    const images = message.content
      .filter((part) => part.type === "image_url")
      .map((part) => part.image_url.url.replace(/^data:[^;,]+;base64,/, ""));
    return {
      ...message,
      content: text,
      ...(images.length > 0 ? { images } : {}),
    };
  });
