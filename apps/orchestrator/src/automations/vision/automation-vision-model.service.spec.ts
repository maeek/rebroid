import { MetricsService } from '../../metrics/metrics.service';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from '../../settings/contracts/ai-provider';
import { AutomationVisionModelService } from './automation-vision-model.service';

it('reads public Vision content from a native Ollama response', async () => {
  const model: AutomationAiProviderModel = {
    id: 'vision:latest',
    label: 'Vision',
    enabled: true,
    roles: ['vision'],
    defaultFor: ['vision'],
    settings: {},
  };
  const provider: AutomationAiProvider = {
    id: 'local',
    label: 'Local',
    kind: 'ollama',
    protocol: 'ollama-native-chat',
    serverFlavor: 'ollama',
    baseUrl: 'http://ollama.test',
    apiKey: null,
    enabled: true,
    models: [model],
  };
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      message: {
        role: 'assistant',
        content: '{"summary":"Settings are open"}',
      },
    }),
  );
  try {
    const result = await new AutomationVisionModelService(
      new MetricsService(),
    ).describeSafe({
      provider,
      model,
      image: {
        dataUrl: 'data:image/png;base64,AA==',
        mimeType: 'image/png',
        capturedAt: '2026-01-01T00:00:00Z',
        optimized: false,
        originalBytes: 1,
        bytes: 1,
        width: 1,
        height: 1,
        renderedWidth: 1,
        renderedHeight: 1,
      },
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://ollama.test/api/chat',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.summary).toBe('Settings are open');
  } finally {
    fetch.mockRestore();
  }
});
