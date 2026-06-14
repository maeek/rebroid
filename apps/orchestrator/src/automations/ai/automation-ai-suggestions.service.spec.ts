import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from '@rebroid/ai-core/provider';
import { AutomationAiSuggestionsService } from './automation-ai-suggestions.service';

const provider: AutomationAiProvider = {
  id: 'local',
  label: 'Local',
  kind: 'ollama',
  baseUrl: 'http://localhost:11434/',
  apiKey: null,
  enabled: true,
  models: [],
};

const model: AutomationAiProviderModel = {
  id: 'qwen',
  label: 'Qwen',
  roles: ['planner'],
  settings: {},
  enabled: true,
  default: true,
};

describe('AutomationAiSuggestionsService', () => {
  it('returns sanitized model suggestions', async () => {
    const service = new AutomationAiSuggestionsService(
      {
        getProvider: jest.fn(async () => ({ provider, model })),
      } as never,
      {
        chat: jest.fn(async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content:
                  '{"suggestions":[{"label":"Open settings","prompt":"Open Android Settings and inspect Display options."}]}',
              },
            },
          ],
        })),
      } as never,
    );

    await expect(
      service.suggest({
        ownerUserId: 'owner',
        targetApplicationId: 'app',
        appName: 'Android 14',
      }),
    ).resolves.toEqual({
      suggestions: [
        {
          id: 'open-settings',
          label: 'Open settings',
          prompt: 'Open Android Settings and inspect Display options.',
        },
      ],
    });
  });

  it('falls back when the provider response is malformed', async () => {
    const service = new AutomationAiSuggestionsService(
      {
        getProvider: jest.fn(async () => ({ provider, model })),
      } as never,
      {
        chat: jest.fn(async () => ({
          choices: [{ message: { role: 'assistant', content: 'not json' } }],
        })),
      } as never,
    );

    const result = await service.suggest({
      ownerUserId: 'owner',
      targetApplicationId: 'app',
      appName: 'Android 14',
    });

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0]?.label).toBe('Inspect screen');
  });
});
