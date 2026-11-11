import { ProviderResponseLimitError } from './ai-provider-http';
import {
  providerProtocol,
  type ChatMessage,
  type ChatToolCall,
} from './ai-provider-request';

export const providerStreamFormat = (
  provider: Parameters<typeof providerProtocol>[0],
) =>
  providerProtocol(provider) === 'ollama-native-chat'
    ? ('ollama-ndjson' as const)
    : ('openai-sse' as const);

export const providerStreamLimits = {
  responseBytes: 32 * 1024 * 1024,
  frameCharacters: 4 * 1024 * 1024,
  contentCharacters: 8 * 1024 * 1024,
  toolCalls: 128,
  toolArgumentsCharacters: 2 * 1024 * 1024,
} as const;

type ChatStreamFormat = 'openai-sse' | 'ollama-ndjson';

interface ChatCompletionUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

interface ChatCompletionTimings {
  promptMs?: number;
  predictedMs?: number;
  cacheTokens?: number;
}

interface ChatCompletionStreamUpdate {
  contentDelta: string;
  reasoningDelta: string;
  toolCallDeltas: ChatToolCallDelta[];
  finishReason?: string;
}

interface ChatToolCallDelta {
  index: number;
  id?: string;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface PendingToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatCompletionStreamResult {
  message: ChatMessage;
  content: string;
  toolCalls: ChatToolCall[];
  reasoningPresent: boolean;
  finishReason?: string;
  usage?: ChatCompletionUsage;
  timings?: ChatCompletionTimings;
}

export const consumeChatCompletionStream = async ({
  body,
  format = 'openai-sse',
  onUpdate,
}: {
  body: ReadableStream<Uint8Array>;
  format?: ChatStreamFormat;
  onUpdate?: (update: ChatCompletionStreamUpdate) => Promise<void> | void;
}): Promise<ChatCompletionStreamResult> => {
  const pendingToolCalls = new Map<number, PendingToolCall>();
  let content = '';
  let reasoningPresent = false;
  let finishReason: string | undefined;
  let usage: ChatCompletionUsage | undefined;
  let timings: ChatCompletionTimings | undefined;

  for await (const frame of readProviderStreamFrames(body, format)) {
    const event = format === 'openai-sse' ? eventData(frame) : frame.trim();
    if (!event) continue;
    if (event === '[DONE]') break;
    const parsed = parseJsonObject(event);
    if (!parsed) continue;
    const update =
      format === 'ollama-ndjson'
        ? parseOllamaUpdate(parsed)
        : parseOpenAiUpdate(parsed);
    if (!update) continue;

    if (
      content.length + update.contentDelta.length >
      providerStreamLimits.contentCharacters
    ) {
      throw new ProviderResponseLimitError('assistant content size');
    }
    if (update.contentDelta) content += update.contentDelta;
    if (update.reasoningDelta) reasoningPresent = true;
    if (update.finishReason) finishReason = update.finishReason;
    if (update.usage) usage = update.usage;
    if (update.timings) timings = update.timings;
    mergeToolCallDeltas(pendingToolCalls, update.toolCallDeltas);
    if (
      update.contentDelta ||
      update.reasoningDelta ||
      update.toolCallDeltas.length > 0 ||
      update.finishReason
    ) {
      await onUpdate?.({
        contentDelta: update.contentDelta,
        reasoningDelta: update.reasoningDelta,
        toolCallDeltas: update.toolCallDeltas,
        ...(update.finishReason ? { finishReason: update.finishReason } : {}),
      });
    }
  }

  const toolCalls = Array.from(pendingToolCalls.entries())
    .sort(([left], [right]) => left - right)
    .map(([, call]) => call)
    .filter((call) => call.id && call.function.name)
    .map((call) => ({
      id: call.id,
      type: 'function' as const,
      function: {
        name: call.function.name,
        arguments: call.function.arguments || '{}',
      },
    }));

  return {
    content,
    toolCalls,
    reasoningPresent,
    ...(finishReason ? { finishReason } : {}),
    ...(usage ? { usage } : {}),
    ...(timings ? { timings } : {}),
    message: {
      role: 'assistant',
      content: content || null,
      tool_calls: toolCalls,
    },
  };
};

interface ParsedStreamUpdate {
  contentDelta: string;
  reasoningDelta: string;
  toolCallDeltas: ChatToolCallDelta[];
  finishReason?: string;
  usage?: ChatCompletionUsage;
  timings?: ChatCompletionTimings;
}

const parseOpenAiUpdate = (
  parsed: Record<string, unknown>,
): ParsedStreamUpdate | null => {
  const choice = Array.isArray(parsed.choices) ? parsed.choices[0] : null;
  const choiceRecord = objectValue(choice);
  const deltaRecord = objectValue(choiceRecord?.delta);
  if (!choiceRecord && !parsed.usage && !parsed.timings) return null;
  return {
    contentDelta: stringValue(deltaRecord?.content),
    reasoningDelta:
      stringValue(deltaRecord?.reasoning_content) ||
      stringValue(deltaRecord?.reasoning),
    toolCallDeltas: parseToolCallDeltas(deltaRecord?.tool_calls),
    ...(stringValue(choiceRecord?.finish_reason)
      ? { finishReason: stringValue(choiceRecord?.finish_reason) }
      : {}),
    ...(parseOpenAiUsage(parsed.usage)
      ? { usage: parseOpenAiUsage(parsed.usage) ?? undefined }
      : {}),
    ...(parseLlamaTimings(parsed.timings)
      ? { timings: parseLlamaTimings(parsed.timings) ?? undefined }
      : {}),
  };
};

const parseOllamaUpdate = (
  parsed: Record<string, unknown>,
): ParsedStreamUpdate | null => {
  const message = objectValue(parsed.message);
  if (!message && parsed.done !== true) return null;
  return {
    contentDelta: stringValue(message?.content),
    reasoningDelta:
      stringValue(message?.thinking) || stringValue(message?.reasoning),
    toolCallDeltas: parseOllamaToolCalls(message?.tool_calls),
    ...(parsed.done === true
      ? { finishReason: stringValue(parsed.done_reason) || 'stop' }
      : {}),
    ...(parseOllamaUsage(parsed)
      ? { usage: parseOllamaUsage(parsed) ?? undefined }
      : {}),
  };
};

export async function* readProviderStreamFrames(
  body: ReadableStream<Uint8Array>,
  format: ChatStreamFormat,
) {
  const separator = format === 'openai-sse' ? /\r?\n\r?\n/ : /\r?\n/;
  const separatorPrefix = format === 'openai-sse' ? /(?:\r?\n\r?|\r)$/ : /\r$/;
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = '';
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      bytes += value?.byteLength ?? 0;
      if (bytes > providerStreamLimits.responseBytes) {
        throw new ProviderResponseLimitError('stream body size');
      }
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(separator);
      buffer = done ? '' : (frames.pop() ?? '');
      for (const frame of frames) {
        if (frame.length > providerStreamLimits.frameCharacters) {
          throw new ProviderResponseLimitError('stream frame size');
        }
        if (!done || frame.trim()) yield frame;
      }
      if (done) return;
      if (
        buffer.length > providerStreamLimits.frameCharacters &&
        buffer.length - (buffer.match(separatorPrefix)?.[0].length ?? 0) >
          providerStreamLimits.frameCharacters
      ) {
        throw new ProviderResponseLimitError('stream frame size');
      }
    }
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

const eventData = (event: string) => {
  const lines = event
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'));
  if (lines.length === 0) return '';
  return lines.map((line) => line.slice('data:'.length).trimStart()).join('\n');
};

const parseJsonObject = (value: string) => {
  try {
    return objectValue(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
};

const objectValue = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const stringValue = (value: unknown) =>
  typeof value === 'string' ? value : '';

const numberValue = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const parseToolCallDeltas = (value: unknown): ChatToolCallDelta[] => {
  if (!Array.isArray(value)) return [];
  const output: ChatToolCallDelta[] = [];
  for (const item of value) {
    const record = objectValue(item);
    if (!record) continue;
    const index = record.index === undefined ? output.length : record.index;
    if (
      typeof index !== 'number' ||
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= providerStreamLimits.toolCalls
    ) {
      throw new ProviderResponseLimitError('tool call index');
    }
    const functionRecord = objectValue(record.function);
    output.push({
      index,
      ...(stringValue(record.id) ? { id: stringValue(record.id) } : {}),
      ...(record.type === 'function' ? { type: 'function' as const } : {}),
      ...(functionRecord
        ? {
            function: {
              ...(stringValue(functionRecord.name)
                ? { name: stringValue(functionRecord.name) }
                : {}),
              ...(typeof functionRecord.arguments === 'string'
                ? { arguments: functionRecord.arguments }
                : functionRecord.arguments !== undefined
                  ? { arguments: JSON.stringify(functionRecord.arguments) }
                  : {}),
            },
          }
        : {}),
    });
  }
  return output;
};

const parseOllamaToolCalls = (value: unknown): ChatToolCallDelta[] =>
  parseToolCallDeltas(value).map((call, index) => ({
    ...call,
    id: call.id || `ollama_call_${index}`,
    type: 'function',
  }));

const parseOpenAiUsage = (value: unknown): ChatCompletionUsage | null => {
  const usage = objectValue(value);
  if (!usage) return null;
  return {
    ...(numberValue(usage.prompt_tokens) !== undefined
      ? { promptTokens: numberValue(usage.prompt_tokens) }
      : {}),
    ...(numberValue(usage.completion_tokens) !== undefined
      ? { completionTokens: numberValue(usage.completion_tokens) }
      : {}),
    ...(numberValue(usage.total_tokens) !== undefined
      ? { totalTokens: numberValue(usage.total_tokens) }
      : {}),
  };
};

const parseOllamaUsage = (
  value: Record<string, unknown>,
): ChatCompletionUsage | null => {
  const promptTokens = numberValue(value.prompt_eval_count);
  const completionTokens = numberValue(value.eval_count);
  if (promptTokens === undefined && completionTokens === undefined) return null;
  return {
    ...(promptTokens !== undefined ? { promptTokens } : {}),
    ...(completionTokens !== undefined ? { completionTokens } : {}),
    ...(promptTokens !== undefined && completionTokens !== undefined
      ? { totalTokens: promptTokens + completionTokens }
      : {}),
  };
};

const parseLlamaTimings = (value: unknown): ChatCompletionTimings | null => {
  const timings = objectValue(value);
  if (!timings) return null;
  return {
    ...(numberValue(timings.prompt_ms) !== undefined
      ? { promptMs: numberValue(timings.prompt_ms) }
      : {}),
    ...(numberValue(timings.predicted_ms) !== undefined
      ? { predictedMs: numberValue(timings.predicted_ms) }
      : {}),
    ...(numberValue(timings.cache_n) !== undefined
      ? { cacheTokens: numberValue(timings.cache_n) }
      : {}),
  };
};

const mergeToolCallDeltas = (
  pendingToolCalls: Map<number, PendingToolCall>,
  deltas: ChatToolCallDelta[],
) => {
  for (const delta of deltas) {
    const current =
      pendingToolCalls.get(delta.index) ??
      ({
        id: '',
        type: 'function',
        function: { name: '', arguments: '' },
      } satisfies PendingToolCall);
    const argumentsText =
      current.function.arguments + (delta.function?.arguments ?? '');
    if (argumentsText.length > providerStreamLimits.toolArgumentsCharacters) {
      throw new ProviderResponseLimitError('tool arguments size');
    }
    pendingToolCalls.set(delta.index, {
      id: delta.id ?? current.id,
      type: delta.type ?? current.type,
      function: {
        name: delta.function?.name ?? current.function.name,
        arguments: argumentsText,
      },
    });
  }
};
