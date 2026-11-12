import { z } from 'zod';
import {
  ProviderResponseLimitError,
  providerRequestHeaders,
  withProviderResponse,
} from './ai-provider-http';
import type { ChatMessage } from './ai-provider-request';
import {
  providerStreamLimits,
  readProviderSseEvents,
  type ChatCompletionStreamResult,
} from './ai-provider-stream';
import type { AutomationAiProvider } from '../settings/contracts/ai-provider';

const providerBaseUrl = (provider: AutomationAiProvider) =>
  provider.baseUrl.replace(/\/+$/, '');
const outputItem = z.looseObject({ type: z.string() });
const completedResponse = z.object({
  status: z.literal('completed'),
  output: z.array(outputItem),
  usage: z
    .object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      total_tokens: z.number(),
    })
    .nullish(),
});
const functionCall = z.object({
  call_id: z.string().min(1),
  name: z.string().min(1),
  arguments: z.string(),
});
const outputMessage = z.object({ content: z.array(outputItem) });
const chatFunctionTool = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.record(z.string(), z.unknown()),
    strict: z.boolean().optional(),
  }),
});

export type OpenAiResponsesHistory = WeakMap<
  ChatMessage,
  z.infer<typeof outputItem>[]
>;

export const withOpenAiResponsesStream = <T>(
  {
    provider,
    model,
    messages,
    tools,
    history,
  }: {
    provider: AutomationAiProvider;
    model: string;
    messages: ChatMessage[];
    tools: unknown[];
    history: OpenAiResponsesHistory;
  },
  options: Parameters<typeof withProviderResponse>[2],
  consume: (response: Response) => Promise<T>,
) => {
  const root = providerBaseUrl(provider).replace(/\/v1$/, '');
  return withProviderResponse(
    `${root}/v1/responses`,
    {
      method: 'POST',
      headers: providerRequestHeaders(provider, { json: true }),
      body: JSON.stringify({
        model,
        input: messages.flatMap((message) => responseInput(message, history)),
        stream: true,
        store: false,
        include: ['reasoning.encrypted_content'],
        ...(tools.length > 0
          ? {
              tools: tools.map((tool) => ({
                type: 'function',
                strict: false,
                ...chatFunctionTool.parse(tool).function,
              })),
              parallel_tool_calls: false,
            }
          : {}),
      }),
    },
    options,
    consume,
  );
};

const responseInput = (
  message: ChatMessage,
  history: OpenAiResponsesHistory,
): Record<string, unknown>[] => {
  // Replay the full output in order, including encrypted reasoning items.
  const output = history.get(message);
  if (output) return output;
  if (message.role === 'tool') {
    return [
      {
        type: 'function_call_output',
        call_id: message.tool_call_id,
        output: message.content,
      },
    ];
  }
  const content = Array.isArray(message.content)
    ? message.content.map((part) =>
        part.type === 'text'
          ? { type: 'input_text', text: part.text }
          : {
              type: 'input_image',
              image_url: part.image_url.url,
              detail: 'auto',
            },
      )
    : (message.content ?? '');
  return [{ role: message.role, content }];
};

export const consumeOpenAiResponsesStream = async (
  body: ReadableStream<Uint8Array>,
  history: OpenAiResponsesHistory,
  onContentDelta: (delta: string) => Promise<void>,
): Promise<ChatCompletionStreamResult> => {
  let streamedCharacters = 0;
  for await (const event of readProviderSseEvents(body)) {
    switch (event.type) {
      case 'response.output_text.delta':
        if (typeof event.delta !== 'string') break;
        streamedCharacters += event.delta.length;
        if (streamedCharacters > providerStreamLimits.contentCharacters) {
          throw new ProviderResponseLimitError('assistant content size');
        }
        await onContentDelta(event.delta);
        break;
      case 'response.completed':
        return completeResponse(event.response, history);
      case 'response.incomplete':
        throw new Error('OpenAI returned an incomplete response.');
      case 'response.failed':
      case 'error':
        throw new Error(
          'OpenAI reported a failure while streaming the response.',
        );
    }
  }
  throw new Error('OpenAI ended the stream before completing the response.');
};

const completeResponse = (
  value: unknown,
  history: OpenAiResponsesHistory,
): ChatCompletionStreamResult => {
  const parsed = completedResponse.safeParse(value);
  if (!parsed.success) throw new Error('OpenAI returned an invalid response.');
  const { output, usage } = parsed.data;
  const toolCalls: ChatCompletionStreamResult['toolCalls'] = [];
  let content = '';
  let reasoningPresent = false;
  for (const item of output) {
    if (item.type === 'reasoning') reasoningPresent = true;
    if (item.type === 'message') {
      const message = outputMessage.safeParse(item);
      if (!message.success)
        throw new Error('OpenAI returned an invalid message.');
      for (const part of message.data.content) {
        if (part.type === 'output_text' && typeof part.text === 'string') {
          content += part.text;
          if (content.length > providerStreamLimits.contentCharacters) {
            throw new ProviderResponseLimitError('assistant content size');
          }
        }
      }
    }
    if (item.type === 'function_call') {
      const call = functionCall.safeParse(item);
      if (!call.success)
        throw new Error('OpenAI returned an invalid function call.');
      if (toolCalls.length >= providerStreamLimits.toolCalls) {
        throw new ProviderResponseLimitError('tool call count');
      }
      if (
        call.data.arguments.length >
        providerStreamLimits.toolArgumentsCharacters
      ) {
        throw new ProviderResponseLimitError('tool arguments size');
      }
      toolCalls.push({
        id: call.data.call_id,
        type: 'function',
        function: { name: call.data.name, arguments: call.data.arguments },
      });
    }
  }
  const message: ChatMessage = {
    role: 'assistant',
    content: content || null,
    tool_calls: toolCalls,
  };
  history.set(message, output);
  return {
    message,
    content,
    toolCalls,
    reasoningPresent,
    finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
    ...(usage && {
      usage: {
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        totalTokens: usage.total_tokens,
      },
    }),
  };
};
