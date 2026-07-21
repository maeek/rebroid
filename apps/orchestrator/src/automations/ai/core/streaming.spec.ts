import { strict as assert } from 'node:assert';
import { DEVICE_DECISION_TOOL_NAME } from './device-decision';
import { consumeChatCompletionStream } from './streaming';

describe('automation AI streaming', () => {
  it('consumes streamed assistant text', async () => {
    const deltas: string[] = [];
    const result = await consumeChatCompletionStream({
      body: streamFromText([
        'data: {"choices":[{"delta":{"content":"Open "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"settings"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
      onUpdate: ({ contentDelta }) => {
        if (contentDelta) deltas.push(contentDelta);
      },
    });

    assert.deepEqual(deltas, ['Open ', 'settings']);
    assert.equal(result.content, 'Open settings');
    assert.deepEqual(result.message, {
      role: 'assistant',
      content: 'Open settings',
      tool_calls: [],
    });
  });

  it('consumes streamed tool calls with chunked arguments', async () => {
    const result = await consumeChatCompletionStream({
      body: streamFromText([
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"android__tap","arguments":"{\\"x\\":"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"10,\\"y\\":20}"}}]}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    });

    assert.deepEqual(result.toolCalls, [
      {
        id: 'call_1',
        type: 'function',
        function: {
          name: 'android__tap',
          arguments: '{"x":10,"y":20}',
        },
      },
    ]);
  });

  it('separates llama.cpp reasoning deltas from the public tool decision', async () => {
    const result = await consumeChatCompletionStream({
      body: streamFromText([
        'data: {"choices":[{"delta":{"reasoning_content":"Need one grounded action."}}]}\n\n',
        `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"decision","type":"function","function":{"name":"${DEVICE_DECISION_TOOL_NAME}","arguments":"{\\"kind\\":\\"finish\\",\\"status\\":\\"blocked\\",\\"finalText\\":\\"No target.\\",\\"evidenceIds\\":[],\\"completedSubgoalIds\\":[]}"}}]}}]}\n\n`,
        'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":100,"completion_tokens":20,"total_tokens":120},"timings":{"prompt_ms":10,"predicted_ms":20,"cache_n":80}}\n\n',
        'data: [DONE]\n\n',
      ]),
    });

    assert.equal(result.reasoningPresent, true);
    assert.equal(result.content, '');
    assert.equal(result.finishReason, 'tool_calls');
    assert.equal(result.usage?.totalTokens, 120);
    assert.equal(result.timings?.cacheTokens, 80);
    assert.equal(result.toolCalls[0]?.function.name, DEVICE_DECISION_TOOL_NAME);
  });

  it('normalizes Ollama native NDJSON thinking and tool calls', async () => {
    const result = await consumeChatCompletionStream({
      format: 'ollama-ndjson',
      body: streamFromText([
        '{"message":{"role":"assistant","thinking":"Inspect snapshot"},"done":false}\n',
        `{"message":{"role":"assistant","content":"","tool_calls":[{"function":{"name":"${DEVICE_DECISION_TOOL_NAME}","arguments":{"kind":"finish","status":"blocked","finalText":"Blocked.","evidenceIds":[],"completedSubgoalIds":[]}}}]},"done":true,"done_reason":"stop","prompt_eval_count":40,"eval_count":10}\n`,
      ]),
    });

    assert.equal(result.reasoningPresent, true);
    assert.equal(result.usage?.totalTokens, 50);
    assert.equal(result.toolCalls[0]?.id, 'ollama_call_0');
  });
});

const streamFromText = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
