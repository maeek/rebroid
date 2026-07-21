import { BadRequestException } from '@nestjs/common';
import type { StoredOrchestratorSettings } from './orchestrator-settings-store';
import { AiProviderSettingsService } from './ai-provider-settings.service';
import { viewerTransport } from '@rebroid/android-application-core/viewer-control';

const createSettings = (): StoredOrchestratorSettings => ({
  defaultContainerImage: 'redroid/redroid:latest',
  dockerImageRegistry: null,
  defaultScrcpyTransport: viewerTransport.WebRTC,
  defaultInactivityTimeoutSeconds: 300,
  maxApkUploadSizeMb: 128,
  services: {
    ocr: {
      endpoint: null,
      timeoutMs: 15000,
      maxImageDimension: 1600,
      minConfidence: 0.4,
      language: 'en',
    },
    firewall: {
      endpoint: '/run/rebroid-firewall/agent.sock',
      timeoutMs: 5000,
    },
  },
  featureFlags: {
    revision: 0,
    values: {
      'feature.ocr': false,
      'feature.firewall': true,
      'feature.image-builder': true,
      'feature.display-virtual': false,
    },
  },
  aiProviders: [
    {
      id: 'primary',
      label: 'Primary',
      kind: 'openai-compatible',
      protocol: 'openai-chat-completions',
      serverFlavor: 'auto',
      baseUrl: 'https://example.test/v1',
      apiKey: 'secret',
      enabled: true,
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
        {
          id: 'vision',
          label: 'Vision',
          roles: ['vision'],
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
          defaultFor: [],
        },
      ],
    },
  ],
});

const createService = (settings = createSettings()) => {
  const store = {
    getStoredSettings: jest.fn(async () => settings),
    updateSettings: jest.fn(
      async (
        update: (
          current: StoredOrchestratorSettings,
        ) => StoredOrchestratorSettings | Promise<StoredOrchestratorSettings>,
      ) => {
        const next = await update(settings);
        Object.assign(settings, next);
        return settings;
      },
    ),
  };
  const service = new AiProviderSettingsService(
    store as never,
    {} as never,
    {} as never,
  );
  return { service, store, settings };
};

describe('AiProviderSettingsService', () => {
  it('selects the default enabled planner model for execution', async () => {
    const { service } = createService();

    const result = await service.getProviderForExecution(
      undefined,
      undefined,
      'planner',
    );

    expect(result.provider.id).toBe('primary');
    expect(result.model.id).toBe('planner');
  });

  it('selects a role-specific model when requested', async () => {
    const { service } = createService();

    const result = await service.getProviderForExecution(
      'primary',
      undefined,
      'vision',
    );

    expect(result.model.id).toBe('vision');
  });

  it('rejects duplicate provider ids on create', async () => {
    const { service, settings, store } = createService();

    await expect(
      service.createProvider({
        id: 'primary',
        label: 'Duplicate',
        kind: 'openai-compatible',
        baseUrl: 'https://duplicate.test/v1',
        apiKey: null,
        enabled: true,
        models: [],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(store.updateSettings).toHaveBeenCalledTimes(1);
    expect(settings.aiProviders).toHaveLength(1);
  });
});
