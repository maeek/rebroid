import { BadRequestException } from '@nestjs/common';
import type { StoredOrchestratorSettings } from './orchestrator-settings-store';
import { AiProviderSettingsService } from './ai-provider-settings.service';
import { viewerTransport } from '@rebroid/android-application-core/viewer-control';
import { withProviderChatResponse } from '../common/ai-provider-request';

const createSettings = (): StoredOrchestratorSettings => ({
  androidRendering: { mode: 'software', renderDevice: null },
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
  it('exposes only the observed billing code and time for the matching OpenAI connection', async () => {
    const settings = createSettings();
    const provider = settings.aiProviders[0];
    Object.assign(provider, {
      kind: 'openai',
      baseUrl: 'https://api.openai.com/v1',
    });
    const compatibleProvider = {
      ...provider,
      id: 'compatible',
      baseUrl: 'https://example.test/v1',
    };
    settings.aiProviders.push(compatibleProvider);
    const { service } = createService(settings);
    const fetch = jest.spyOn(global, 'fetch');
    const modelResponse = (target = provider) =>
      withProviderChatResponse(
        { provider: target, model: target.models[0], messages: [] },
        {},
        (response) => response.text(),
      );
    const billingError = () =>
      Response.json(
        {
          error: {
            type: 'insufficient_quota',
            code: 'project_spend_limit_exceeded',
            message: 'Private upstream detail',
          },
        },
        { status: 429 },
      );

    try {
      fetch.mockResolvedValueOnce(billingError());
      await modelResponse();
      const [listed] = await service.listProviders();
      expect(listed.billingIssue).toEqual({
        code: 'project_spend_limit_exceeded',
        observedAt: expect.any(String),
      });
      expect(JSON.stringify(listed)).not.toContain('Private upstream detail');
      expect(listed.apiKey).not.toBe(provider.apiKey);

      fetch.mockResolvedValueOnce(billingError());
      await modelResponse(compatibleProvider);
      const [, compatible] = await service.listProviders();
      expect(compatible.billingIssue).toBeUndefined();

      fetch.mockResolvedValueOnce(
        Response.json(
          { error: { code: 'rate_limit_exceeded' } },
          { status: 429 },
        ),
      );
      await modelResponse();
      expect((await service.listProviders())[0].billingIssue).toEqual(
        listed.billingIssue,
      );

      fetch.mockResolvedValueOnce(Response.json({ choices: [] }));
      await modelResponse();
      expect((await service.listProviders())[0].billingIssue).toBeUndefined();

      fetch.mockResolvedValueOnce(billingError());
      await modelResponse();
      const updated = await service.updateProvider(provider.id, {
        apiKey: 'replacement',
      });
      expect(updated.billingIssue).toBeUndefined();
      expect((await service.listProviders())[0].billingIssue).toBeUndefined();
    } finally {
      fetch.mockRestore();
    }
  });

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

  it('skips providers without a model for the requested default role', async () => {
    const settings = createSettings();
    const primary = settings.aiProviders[0];
    settings.aiProviders.unshift({
      ...primary,
      id: 'device-only',
      models: [
        {
          ...primary.models[0],
          id: 'controller',
          roles: ['controller'],
          defaultFor: ['controller'],
        },
      ],
    });
    const { service } = createService(settings);

    await expect(
      service.getProviderForExecution(undefined, undefined, 'planner'),
    ).resolves.toMatchObject({
      provider: { id: 'primary' },
      model: { id: 'planner' },
    });
    await expect(
      service.getProviderForExecution('device-only', undefined, 'planner'),
    ).rejects.toThrow('No enabled planner AI model');
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
