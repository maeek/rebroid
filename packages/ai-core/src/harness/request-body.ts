import type { ChatMessage } from "./types";
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from "../provider/types";

export const chatCompletionsEndpoint = (provider: AutomationAiProvider) =>
  provider.kind === "ollama"
    ? `${provider.baseUrl.replace(/\/+$/, "")}/v1/chat/completions`
    : `${provider.baseUrl.replace(/\/+$/, "")}/chat/completions`;

export const buildChatRequestBody = ({
  messages,
  model,
  provider,
  stream = false,
  tools,
}: {
  messages: ChatMessage[];
  model: AutomationAiProviderModel;
  provider: AutomationAiProvider;
  stream?: boolean;
  tools: unknown[];
}) => ({
  model: model.id,
  messages,
  tools,
  tool_choice: "auto",
  stream,
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

export const ollamaOptions = (model: AutomationAiProviderModel) =>
  Object.fromEntries(
    [
      ["num_ctx", model.settings.numCtx],
      ["repeat_penalty", model.settings.repeatPenalty],
      ["seed", model.settings.seed],
      ["top_k", model.settings.topK],
    ].filter(([, value]) => value !== null && value !== undefined),
  );
