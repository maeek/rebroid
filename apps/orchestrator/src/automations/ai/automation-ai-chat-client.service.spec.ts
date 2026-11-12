import { BadRequestException } from '@nestjs/common';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from '../../settings/contracts/ai-provider';
import { AutomationAiChatClientService } from './automation-ai-chat-client.service';

const provider: AutomationAiProvider = {
  id: 'local',
  label: 'Local',
  kind: 'ollama',
  protocol: 'openai-chat-completions',
  serverFlavor: 'auto',
  baseUrl: 'http://localhost:11434/',
  apiKey: 'secret',
  enabled: true,
  models: [],
};

const model: AutomationAiProviderModel = {
  id: 'qwen',
  label: 'Qwen',
  roles: ['planner'],
  settings: {
    systemPrompt: null,
    temperature: 0.2,
    topP: null,
    topK: null,
    numCtx: null,
    repeatPenalty: null,
    seed: null,
    keepAlive: null,
  },
  enabled: true,
  defaultFor: ['planner'],
};

const streamFromText = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });

describe('AutomationAiChatClientService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('posts provider chat requests and consumes streamed assistant text', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        new Response(
          streamFromText([
            'data: {"choices":[{"delta":{"content":"Open "}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"settings"}}]}\n\n',
            'data: [DONE]\n\n',
          ]),
          { status: 200 },
        ),
      );
    global.fetch = fetchMock;
    const deltas: string[] = [];

    const result = await new AutomationAiChatClientService().chat({
      provider,
      model,
      messages: [{ role: 'user', content: 'Do it' }],
      tools: [],
      deadline: Date.now() + 10_000,
      onContentDelta: async (delta) => {
        deltas.push(delta);
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          authorization: 'Bearer secret',
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      model: 'qwen',
      stream: true,
      temperature: 0.2,
      messages: [{ role: 'user', content: 'Do it' }],
    });
    expect(body.tools).toBeUndefined();
    expect(result.choices[0].message.content).toBe('Open settings');
    expect(deltas.join('')).toBe('Open settings');
  });

  it('uses OpenAI tool compatibility for Luna controller requests', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response(streamFromText(['data: [DONE]\n\n'])));
    global.fetch = fetchMock;

    await new AutomationAiChatClientService().chat({
      provider: {
        ...provider,
        kind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
      },
      model: {
        ...model,
        id: 'gpt-5.6-luna',
        settings: { ...model.settings, thinkingMode: 'disabled', topP: 0.9 },
      },
      messages: [],
      tools: [
        { type: 'function', function: { name: 'submit_device_decision' } },
      ],
      deadline: Date.now() + 10_000,
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as Record<
      string,
      unknown
    >;
    expect(body).toHaveProperty('reasoning_effort', 'none');
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('top_p');
    expect(body).not.toHaveProperty('chat_template_kwargs');
  });

  it.each(['controller', 'planner'] as const)(
    'attributes %s requests and failures to the supplied role',
    async (role) => {
      const finish = jest.fn();
      const metrics = { beginAiProviderRequest: jest.fn(() => finish) };
      global.fetch = jest
        .fn()
        .mockResolvedValue(new Response(streamFromText(['data: [DONE]\n\n'])));
      const client = new AutomationAiChatClientService(metrics as never);
      const request = {
        provider,
        model,
        messages: [],
        tools: [],
        deadline: Date.now() + 10_000,
        role,
      };
      await client.chat(request);
      expect(metrics.beginAiProviderRequest).toHaveBeenCalledWith('chat', role);
      expect(finish).toHaveBeenLastCalledWith('success');
      global.fetch = jest.fn().mockRejectedValue(new Error('unavailable'));
      await expect(client.chat(request)).rejects.toThrow('unavailable');
      expect(finish).toHaveBeenLastCalledWith('error');
    },
  );

  it('raises bounded provider errors', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    global.fetch = jest.fn().mockResolvedValue(
      new Response('{"error":{"message":"bad request"}}', {
        status: 400,
        statusText: 'Bad Request',
      }),
    );

    await expect(
      new AutomationAiChatClientService().chat({
        provider,
        model,
        messages: [],
        tools: [],
        deadline: Date.now() + 10_000,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
