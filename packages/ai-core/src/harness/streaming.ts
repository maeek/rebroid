import type { ChatMessage, ChatToolCall } from "./types";

export interface ChatCompletionStreamUpdate {
  contentDelta: string;
  toolCallDeltas: ChatToolCallDelta[];
}

export interface ChatToolCallDelta {
  index: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface PendingToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionStreamResult {
  message: ChatMessage;
  content: string;
  toolCalls: ChatToolCall[];
}

export const consumeChatCompletionStream = async ({
  body,
  onUpdate,
}: {
  body: ReadableStream<Uint8Array>;
  onUpdate?: (update: ChatCompletionStreamUpdate) => Promise<void> | void;
}): Promise<ChatCompletionStreamResult> => {
  const pendingToolCalls = new Map<number, PendingToolCall>();
  let content = "";

  for await (const event of parseServerSentEvents(body)) {
    if (event === "[DONE]") break;
    const parsed = parseJsonObject(event);
    if (!parsed) continue;
    const choice = Array.isArray(parsed.choices) ? parsed.choices[0] : null;
    const delta =
      choice && typeof choice === "object"
        ? (choice as Record<string, unknown>).delta
        : null;
    if (!delta || typeof delta !== "object") continue;

    const deltaRecord = delta as Record<string, unknown>;
    const contentDelta =
      typeof deltaRecord.content === "string" ? deltaRecord.content : "";
    const toolCallDeltas = parseToolCallDeltas(deltaRecord.tool_calls);

    if (contentDelta) content += contentDelta;
    mergeToolCallDeltas(pendingToolCalls, toolCallDeltas);
    if (contentDelta || toolCallDeltas.length > 0) {
      await onUpdate?.({ contentDelta, toolCallDeltas });
    }
  }

  const toolCalls = Array.from(pendingToolCalls.entries())
    .sort(([left], [right]) => left - right)
    .map(([, call]) => call)
    .filter((call) => call.id && call.function.name)
    .map((call) => ({
      id: call.id,
      type: "function" as const,
      function: {
        name: call.function.name,
        arguments: call.function.arguments || "{}",
      },
    }));

  return {
    content,
    toolCalls,
    message: {
      role: "assistant",
      content: content || null,
      tool_calls: toolCalls,
    },
  };
};

const parseServerSentEvents = async function* (
  body: ReadableStream<Uint8Array>,
) {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
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

const eventData = (event: string) => {
  const lines = event
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"));
  if (lines.length === 0) return "";
  return lines.map((line) => line.slice("data:".length).trimStart()).join("\n");
};

const parseJsonObject = (value: string) => {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const parseToolCallDeltas = (value: unknown): ChatToolCallDelta[] => {
  if (!Array.isArray(value)) return [];
  const output: ChatToolCallDelta[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const index =
      typeof record.index === "number" ? record.index : output.length;
    const functionValue = record.function;
    const functionRecord =
      functionValue && typeof functionValue === "object"
        ? (functionValue as Record<string, unknown>)
        : null;
    output.push({
      index,
      ...(typeof record.id === "string" ? { id: record.id } : {}),
      ...(record.type === "function" ? { type: "function" as const } : {}),
      ...(functionRecord
        ? {
            function: {
              ...(typeof functionRecord.name === "string"
                ? { name: functionRecord.name }
                : {}),
              ...(typeof functionRecord.arguments === "string"
                ? { arguments: functionRecord.arguments }
                : {}),
            },
          }
        : {}),
    });
  }
  return output;
};

const mergeToolCallDeltas = (
  pendingToolCalls: Map<number, PendingToolCall>,
  deltas: ChatToolCallDelta[],
) => {
  for (const delta of deltas) {
    const current =
      pendingToolCalls.get(delta.index) ??
      ({
        id: "",
        type: "function",
        function: { name: "", arguments: "" },
      } satisfies PendingToolCall);
    pendingToolCalls.set(delta.index, {
      id: delta.id ?? current.id,
      type: delta.type ?? current.type,
      function: {
        name: delta.function?.name ?? current.function.name,
        arguments:
          current.function.arguments + (delta.function?.arguments ?? ""),
      },
    });
  }
};
