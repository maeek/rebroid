import { BadRequestException } from '@nestjs/common';
import type { StoredOrchestratorSettings } from './orchestrator-settings-store';
import { AiProviderSettingsService } from './ai-provider-settings.service';
import { ScrcpyTransport } from '../android-apps/android-application-status';

const createSettings = (): StoredOrchestratorSettings => ({
  defaultContainerImage: 'redroid/redroid:latest',
  dockerImageRegistry: null,
  defaultScrcpyTransport: ScrcpyTransport.WebRTC,
  defaultInactivityTimeoutSeconds: 300,
  maxApkUploadSizeMb: 128,
  services: {
    ocr: {
      enabled: false,
      endpoint: null,
      timeoutMs: 15000,
      maxImageDimension: 1600,
      minConfidence: 0.4,
      languages: ['en'],
      preprocessingModes: ['raw'],
    },
    firewall: {
      enabled: true,
      endpoint: '/run/rebroid-firewall/agent.sock',
      timeoutMs: 5000,
    },
  },
  aiProviders: [
    {
      id: 'primary',
      label: 'Primary',
      kind: 'openai-compatible',
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
    writeSettings: jest.fn(async (next: StoredOrchestratorSettings) => {
      Object.assign(settings, next);
    }),
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
    const { service, store } = createService();

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
    expect(store.writeSettings).not.toHaveBeenCalled();
  });
});
