import { AiProviderHealthService } from './ai-provider-health.service';
import type { AutomationAiProvider } from '@rebroid/ai-core/provider';

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
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      type: 'function',
                      function: { name: 'health_check_noop', arguments: '{}' },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
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
