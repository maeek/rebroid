import { MetricsService } from '../../metrics/metrics.service';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from '../../settings/contracts/ai-provider';
import { AutomationVisionModelService } from './automation-vision-model.service';

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
const image = {
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
} as const;

it('reads public Vision content from a native Ollama response', async () => {
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
      image,
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

it('filters invalid and out-of-region model matches before the result cap', async () => {
  const matches = [
    {
      label: 'Invalid bounds',
      confidence: 0.99,
      bounds: { left: 0.2, top: 0.2, width: -1, height: 0.1 },
    },
    {
      label: 'Outside the region',
      confidence: 0.99,
      bounds: { left: 0.8, top: 0.8, width: 0.1, height: 0.1 },
    },
    {
      label: 'Żappka',
      confidence: 0.95,
      bounds: { left: 0.2, top: 0.2, width: 0.1, height: 0.1 },
    },
  ];
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      message: {
        role: 'assistant',
        content: ['```json', JSON.stringify({ matches }), '```'].join('\n'),
      },
    }),
  );
  try {
    const result = await new AutomationVisionModelService(
      new MetricsService(),
    ).locateSafe({
      provider,
      model,
      image,
      input: {
        query: 'Żappka',
        threshold: 0.8,
        maxResults: 1,
        region: { left: 0, top: 0, width: 0.5, height: 0.5 },
      },
    });
    expect(result.matches).toEqual([
      expect.objectContaining({
        label: 'Żappka',
        source: 'vision-model',
        center: { x: 0.25, y: 0.25 },
      }),
    ]);
  } finally {
    fetch.mockRestore();
  }
});
