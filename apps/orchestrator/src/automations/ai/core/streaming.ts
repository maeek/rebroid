import type {
  ChatMessage,
  ChatToolCall,
} from '../../../common/ai-provider-request';

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

  for await (const event of parseChatEvents(body, format)) {
    if (event === '[DONE]') break;
    const parsed = parseJsonObject(event);
    if (!parsed) continue;
    const update =
      format === 'ollama-ndjson'
        ? parseOllamaUpdate(parsed)
        : parseOpenAiUpdate(parsed);
    if (!update) continue;

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

const parseChatEvents = async function* (
  body: ReadableStream<Uint8Array>,
  format: ChatStreamFormat,
) {
  if (format === 'ollama-ndjson') {
    yield* parseNewlineDelimitedJson(body);
    return;
  }
  yield* parseServerSentEvents(body);
};

const parseServerSentEvents = async function* (
  body: ReadableStream<Uint8Array>,
) {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';
      for (const event of events) {
        const data = eventData(event);
        if (data) yield data;
      }
    }
    buffer += decoder.decode();
    const data = eventData(buffer);
    if (data) yield data;
  } finally {
    reader.releaseLock();
  }
};

const parseNewlineDelimitedJson = async function* (
  body: ReadableStream<Uint8Array>,
) {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) yield line.trim();
    }
    buffer += decoder.decode();
    if (buffer.trim()) yield buffer.trim();
  } finally {
    reader.releaseLock();
  }
};

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
    const index = numberValue(record.index) ?? output.length;
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
    pendingToolCalls.set(delta.index, {
      id: delta.id ?? current.id,
      type: delta.type ?? current.type,
      function: {
        name: delta.function?.name ?? current.function.name,
        arguments:
          current.function.arguments + (delta.function?.arguments ?? ''),
      },
    });
  }
};
