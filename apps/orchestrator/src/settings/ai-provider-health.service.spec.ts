import { maximumProviderJsonBytes } from '../common/ai-provider-http';
import { AiProviderHealthService } from './ai-provider-health.service';
import type { AutomationAiProvider } from './contracts/ai-provider';

const provider = (
  override: Partial<AutomationAiProvider> = {},
): AutomationAiProvider => ({
  id: 'local',
  label: 'Local',
  kind: 'openai-compatible',
  protocol: 'openai-chat-completions',
  serverFlavor: 'auto',
  baseUrl: 'https://example.test/v1',
  apiKey: null,
  enabled: false,
  models: [
    {
      id: 'planner',
      label: 'Planner',
      roles: ['planner'],
      settings: {
        systemPrompt: null,
        temperature: null,
        topP: null,
        topK: null,
        numCtx: null,
        repeatPenalty: null,
        seed: null,
        keepAlive: null,
      },
      enabled: true,
      defaultFor: ['planner'],
    },
  ],
  ...override,
});

describe('AiProviderHealthService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('reports invalid JSON when listing remote models', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('invalid JSON'));

    await expect(
      new AiProviderHealthService().listRemoteModels(provider()),
    ).rejects.toThrow('Provider returned malformed JSON.');
  });

  it('cancels an oversized remote model list', async () => {
    const cancel = jest.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(maximumProviderJsonBytes + 1));
      },
      cancel,
    });
    global.fetch = jest.fn().mockResolvedValue(new Response(body));

    await expect(
      new AiProviderHealthService().listRemoteModels(provider()),
    ).rejects.toThrow('JSON body size');
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
  });

  it('checks connectivity for disabled providers', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'planner' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    global.fetch = fetchMock;

    const result = await new AiProviderHealthService().checkProviderHealth(
      provider(),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/v1/models',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.status).toBe('ok');
    expect(result.message).toBe(
      'Provider is reachable and model "planner" is available.',
    );
  });

  it('probes a schema-only controller through streaming without tools', async () => {
    const model = {
      ...provider().models[0],
      roles: ['controller' as const],
      capabilities: { structuredOutput: true, tools: false },
    };
    const mock = jest
      .fn()
      .mockResolvedValueOnce(Response.json({ data: [{ id: model.id }] }))
      .mockResolvedValueOnce(
        new Response(
          'data: ' +
            JSON.stringify({
              choices: [
                { delta: { content: '{"ok":true}' }, finish_reason: 'stop' },
              ],
            }) +
            '\n\ndata: [DONE]\n\n',
        ),
      );
    global.fetch = mock;
    const service = new AiProviderHealthService();
    const result = await service.checkProviderHealth(
      provider({ serverFlavor: 'openai', models: [model] }),
      model.id,
      'controller',
    );
    expect(result.status).toBe('ok');
    const request = (mock.mock.calls[1] as [string, RequestInit])[1];
    expect(JSON.parse(String(request.body))).toMatchObject({
      stream: true,
      response_format: { type: 'json_schema' },
    });
    expect(JSON.parse(String(request.body))).not.toHaveProperty('tools');
  });

  it('requires the controller probe to produce the requested tool call', async () => {
    const configured = provider({
      enabled: true,
      serverFlavor: 'openai',
      models: [
        {
          id: 'controller',
          label: 'Controller',
          roles: ['controller'],
          settings: {},
          enabled: true,
          defaultFor: ['controller'],
        },
      ],
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: 'controller' }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          'data: ' +
            JSON.stringify({
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        id: 'call-1',
                        type: 'function',
                        function: {
                          name: 'health_check_noop',
                          arguments: '{}',
                        },
                      },
                    ],
                  },
                  finish_reason: 'tool_calls',
                },
              ],
            }) +
            '\n\ndata: [DONE]\n\n',
        ),
      );

    const result = await new AiProviderHealthService().checkProviderHealth(
      configured,
      'controller',
      'controller',
    );

    expect(result.status).toBe('ok');
  });
});
