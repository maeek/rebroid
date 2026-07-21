import {
  MASKED_API_KEY,
  normalizeAiModel,
  normalizeAiProvider,
  normalizeDefaultModel,
  resolveUpdatedApiKey,
} from './ai-provider-settings';
import { parseProviderRemoteModels } from './ai-provider-remote-models';

describe('AI provider normalization', () => {
  it('normalizes persisted provider and model input', () => {
    expect(
      normalizeAiProvider({
        id: 'openai',
        label: 'OpenAI',
        kind: 'openai',
        protocol: 'openai-chat-completions',
        serverFlavor: 'openai',
        baseUrl: 'https://api.openai.com///',
        models: [{ id: 'gpt-4o', label: '', default: true }],
      }),
    ).toMatchObject({
      id: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      models: [
        {
          id: 'gpt-4o',
          label: 'gpt-4o',
          roles: ['controller', 'planner'],
          defaultFor: ['controller', 'planner'],
        },
      ],
    });
  });

  it('keeps one enabled default model for each role', () => {
    const models = [
      normalizeAiModel({ id: 'a', label: 'a', default: true, enabled: false }),
      normalizeAiModel({
        id: 'b',
        label: 'b',
        roles: ['planner', 'vision'],
        defaultFor: ['planner', 'vision'],
        enabled: true,
      }),
      normalizeAiModel({
        id: 'c',
        label: 'c',
        roles: ['vision'],
        defaultFor: ['vision'],
        enabled: true,
      }),
    ];

    expect(
      normalizeDefaultModel(models).map((model) => model.defaultFor),
    ).toEqual([[], ['controller', 'planner', 'vision'], []]);
  });

  it('preserves masked API keys during updates', () => {
    expect(resolveUpdatedApiKey('stored', undefined)).toBe('stored');
    expect(resolveUpdatedApiKey('stored', MASKED_API_KEY)).toBe('stored');
    expect(resolveUpdatedApiKey('stored', ' next ')).toBe('next');
    expect(resolveUpdatedApiKey('stored', '')).toBeNull();
  });

  it('parses OpenAI-compatible remote model discovery', () => {
    const provider = normalizeAiProvider({
      id: 'local',
      label: 'Local',
      kind: 'ollama',
      protocol: 'openai-chat-completions',
      serverFlavor: 'auto',
      baseUrl: 'http://localhost:11434',
      enabled: true,
      models: [],
    });

    expect(
      parseProviderRemoteModels(provider, {
        data: [
          {
            id: 'Gemma-4-E4B-it-GGUF',
            labels: ['tool-calling', 'vision', 'llamacpp'],
          },
        ],
      }),
    ).toEqual([
      {
        id: 'Gemma-4-E4B-it-GGUF',
        label: 'Gemma-4-E4B-it-GGUF',
        capabilities: { tools: true, vision: true },
      },
    ]);
  });
});
