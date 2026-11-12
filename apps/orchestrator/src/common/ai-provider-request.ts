import {
  providerRequestHeaders,
  withProviderResponse,
} from './ai-provider-http';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
  AutomationAiProviderProtocol,
  AutomationAiProviderServerFlavor,
} from '../settings/contracts/ai-provider';

export interface ChatToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ChatTextContentPart {
  type: 'text';
  text: string;
}

interface ChatImageUrlContentPart {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

type ChatContentPart = ChatTextContentPart | ChatImageUrlContentPart;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ChatContentPart[] | null;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
}

export type ChatResponseFormat =
  | { type: 'json_object' }
  | { type: 'json_schema'; name?: string; schema: Record<string, unknown> };

export const modelSupportsStructuredOutput = (
  model: AutomationAiProviderModel,
) => model.capabilities?.structuredOutput === true;
export const modelSupportsTools = (model: AutomationAiProviderModel) =>
  model.capabilities?.tools !== false;

export const deviceControllerResponseMode = (
  model: AutomationAiProviderModel,
) => {
  if (modelSupportsStructuredOutput(model)) return 'schema';
  return modelSupportsTools(model) ? 'tool' : null;
};

export const providerProtocol = (
  provider: Pick<AutomationAiProvider, 'protocol'>,
): AutomationAiProviderProtocol =>
  provider.protocol ?? 'openai-chat-completions';

export const isOfficialOpenAiProvider = (provider: AutomationAiProvider) =>
  provider.kind === 'openai' &&
  providerProtocol(provider) === 'openai-chat-completions' &&
  /^https:\/\/api\.openai\.com(?:\/v1)?\/*$/.test(provider.baseUrl);

const providerServerFlavor = (
  provider: Pick<AutomationAiProvider, 'kind' | 'serverFlavor'>,
): AutomationAiProviderServerFlavor =>
  provider.serverFlavor ?? (provider.kind === 'openai' ? 'openai' : 'auto');

const providerOpenAiRoot = (provider: AutomationAiProvider) => {
  const baseUrl = provider.baseUrl.replace(/\/+$/, '');
  if (/\/v1$/i.test(baseUrl)) return baseUrl;
  const flavor = providerServerFlavor(provider);
  if (
    isOfficialOpenAiProvider(provider) ||
    provider.kind === 'ollama' ||
    flavor === 'llama-cpp' ||
    flavor === 'lemonade' ||
    flavor === 'ollama'
  ) {
    return `${baseUrl}/v1`;
  }
  return baseUrl;
};

export const chatCompletionsEndpoint = (provider: AutomationAiProvider) =>
  providerProtocol(provider) === 'ollama-native-chat'
    ? `${provider.baseUrl.replace(/\/+$/, '')}/api/chat`
    : `${providerOpenAiRoot(provider)}/chat/completions`;

export const providerModelsEndpoint = (provider: AutomationAiProvider) =>
  providerProtocol(provider) === 'ollama-native-chat'
    ? `${provider.baseUrl.replace(/\/+$/, '')}/api/tags`
    : `${providerOpenAiRoot(provider)}/models`;

export const withProviderChatResponse = <T>(
  request: Parameters<typeof buildChatRequestBody>[0],
  options: Parameters<typeof withProviderResponse>[2],
  consume: (response: Response) => Promise<T>,
) =>
  withProviderResponse(
    chatCompletionsEndpoint(request.provider),
    {
      method: 'POST',
      headers: providerRequestHeaders(request.provider, { json: true }),
      body: JSON.stringify(buildChatRequestBody(request)),
    },
    options,
    consume,
  );

export const providerAssistantMessage = (body: unknown) => {
  const root = objectRecord(body);
  const choice = Array.isArray(root?.choices)
    ? objectRecord(root.choices[0])
    : null;
  return objectRecord(choice?.message) ?? objectRecord(root?.message);
};

const objectRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

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
  if (providerProtocol(provider) === 'ollama-native-chat') {
    return {
      model: model.id,
      messages: ollamaMessages(messages),
      ...(hasTools ? { tools } : {}),
      ...(responseFormat?.type === 'json_schema'
        ? { format: responseFormat.schema }
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
      ...(model.settings.thinkingMode === 'disabled' ? { think: false } : {}),
      ...(model.settings.thinkingMode === 'bounded' ? { think: true } : {}),
    };
  }

  const openAi = provider.kind === 'openai';
  return {
    model: model.id,
    messages,
    ...(hasTools
      ? { tools, tool_choice: 'auto', parallel_tool_calls: false }
      : {}),
    ...(responseFormat
      ? { response_format: openAiResponseFormat(responseFormat) }
      : {}),
    stream,
    ...(!openAi ? { temperature: model.settings.temperature ?? 0.2 } : {}),
    ...(!openAi &&
    model.settings.topP !== null &&
    model.settings.topP !== undefined
      ? { top_p: model.settings.topP }
      : {}),
    ...(openAi && hasTools && /^gpt-5\.6(?:-|$)/.test(model.id)
      ? { reasoning_effort: 'none' }
      : {}),
    ...(!openAi && model.settings.thinkingMode === 'disabled'
      ? {
          reasoning_format: 'deepseek',
          chat_template_kwargs: { enable_thinking: false },
        }
      : {}),
    ...(!openAi && model.settings.thinkingMode === 'bounded'
      ? {
          reasoning_format: 'deepseek',
          reasoning_budget: model.settings.reasoningBudgetTokens ?? 512,
        }
      : {}),
  };
};

const openAiResponseFormat = (responseFormat: ChatResponseFormat) => {
  if (responseFormat.type === 'json_object') return { type: 'json_object' };
  return {
    type: 'json_schema',
    json_schema: {
      name: responseFormat.name ?? 'structured_response',
      strict: true,
      schema: responseFormat.schema,
    },
  };
};

const ollamaOptions = (model: AutomationAiProviderModel) =>
  Object.fromEntries(
    [
      ['num_ctx', model.settings.numCtx],
      ['repeat_penalty', model.settings.repeatPenalty],
      ['seed', model.settings.seed],
      ['top_k', model.settings.topK],
    ].filter(([, value]) => value !== null && value !== undefined),
  );

const ollamaMessages = (messages: ChatMessage[]) =>
  messages.map((message) => {
    if (!Array.isArray(message.content)) return message;
    const text = message.content
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n');
    const images = message.content
      .filter((part) => part.type === 'image_url')
      .map((part) => part.image_url.url.replace(/^data:[^;,]+;base64,/, ''));
    return {
      ...message,
      content: text,
      ...(images.length > 0 ? { images } : {}),
    };
  });
