import {
  consumeChatCompletionStream,
  providerStreamLimits,
} from './ai-provider-stream';

const stream = (chunks: string[], cancel = jest.fn()) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(new TextEncoder().encode(chunk));
    },
    cancel,
  });

describe('provider stream limits', () => {
  it.each(['openai-sse', 'ollama-ndjson'] as const)(
    'cancels an unterminated oversized %s frame',
    async (format) => {
      const cancel = jest.fn();
      const body = stream(
        ['x'.repeat(providerStreamLimits.frameCharacters), 'x'],
        cancel,
      );
      await expect(
        consumeChatCompletionStream({ body, format }),
      ).rejects.toThrow('stream frame size');
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(body.locked).toBe(false);
    },
  );

  it.each([
    ['openai-sse', '\r\n\r', 'data: {"choices":[{"delta":{"content":"ok"}}]}'],
    ['ollama-ndjson', '\r', '{"message":{"content":"ok"}}'],
  ] as const)(
    'accepts an exactly bounded %s frame with a split separator',
    async (format, separatorPrefix, event) => {
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              event.padEnd(providerStreamLimits.frameCharacters, ' ') +
                separatorPrefix,
            ),
          );
          controller.enqueue(encoder.encode('\n'));
          controller.close();
        },
      });
      await expect(
        consumeChatCompletionStream({ body, format }),
      ).resolves.toMatchObject({ content: 'ok' });
    },
  );

  it.each([-1, 0.5, providerStreamLimits.toolCalls, '0', null])(
    'rejects invalid tool index %s',
    async (index) => {
      const frame = JSON.stringify({
        choices: [{ delta: { tool_calls: [{ index, id: 'call' }] } }],
      });
      await expect(
        consumeChatCompletionStream({ body: stream([`data: ${frame}\n\n`]) }),
      ).rejects.toThrow('tool call index');
    },
  );

  it('bounds tool arguments accumulated across valid frames', async () => {
    const tool = (argumentsText: string) =>
      'data: ' +
      JSON.stringify({
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, function: { arguments: argumentsText } },
              ],
            },
          },
        ],
      }) +
      '\n\n';
    await expect(
      consumeChatCompletionStream({
        body: stream([
          tool('x'.repeat(providerStreamLimits.toolArgumentsCharacters)),
          tool('x'),
        ]),
      }),
    ).rejects.toThrow('tool arguments size');
  });

  it('bounds assistant content accumulated across valid frames', async () => {
    const frame =
      'data: ' +
      JSON.stringify({
        choices: [{ delta: { content: 'x'.repeat(1024 * 1024) } }],
      }) +
      '\n\n';
    await expect(
      consumeChatCompletionStream({ body: stream(Array(9).fill(frame)) }),
    ).rejects.toThrow('assistant content size');
  });

  it('bounds the total stream including ignored frames', async () => {
    const frame = ': ' + 'x'.repeat(1024 * 1024) + '\n\n';
    await expect(
      consumeChatCompletionStream({ body: stream(Array(32).fill(frame)) }),
    ).rejects.toThrow('stream body size');
  });
});
