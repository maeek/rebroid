import { AiProviderHealthService } from './ai-provider-health.service';
import type { AutomationAiProvider } from '@rebroid/ai-core/provider';

const provider = (override: Partial<AutomationAiProvider> = {}): AutomationAiProvider => ({
  id: 'local',
  label: 'Local',
  kind: 'openai-compatible',
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
      default: true,
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
});
