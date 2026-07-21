import { ConflictException } from '@nestjs/common';
import type { StoredOrchestratorSettings } from '../settings/orchestrator-settings-store';
import { featureFlagDefinitions } from './feature-flag.registry';
import {
  FeatureDisabledException,
  FeatureFlagsService,
} from './feature-flags.service';

class SettingsStoreStub {
  private listeners = new Set<(settings: StoredOrchestratorSettings) => void>();

  constructor(private settings: StoredOrchestratorSettings) {}

  defaults = jest.fn(() => this.settings);
  getStoredSettings = jest.fn(async () => this.settings);
  subscribe = jest.fn(
    (listener: (settings: StoredOrchestratorSettings) => void) => {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    },
  );
  updateSettings = jest.fn(
    async (
      update: (
        settings: StoredOrchestratorSettings,
      ) => StoredOrchestratorSettings,
    ) => {
      this.settings = update(this.settings);
      for (const listener of this.listeners) listener(this.settings);
      return this.settings;
    },
  );
}

const settings = (): StoredOrchestratorSettings => ({
  defaultContainerImage: 'rebroid:test',
  dockerImageRegistry: null,
  defaultScrcpyTransport: 'webrtc',
  defaultInactivityTimeoutSeconds: 900,
  maxApkUploadSizeMb: 64,
  services: {
    ocr: {
      endpoint: 'http://ocr.test',
      timeoutMs: 1_000,
      maxImageDimension: 1_600,
      minConfidence: 0.4,
      language: 'en',
    },
    firewall: { endpoint: '/run/firewall.sock', timeoutMs: 1_000 },
  },
  aiProviders: [],
  featureFlags: {
    revision: 0,
    values: Object.fromEntries(
      featureFlagDefinitions.map((definition) => [
        definition.key,
        definition.defaultEnabled,
      ]),
    ) as StoredOrchestratorSettings['featureFlags']['values'],
  },
});

const config = {
  get: jest.fn((key: string) => {
    if (key === 'app.ocr.baseUrl') return 'http://ocr.test';
    if (key === 'app.firewallAgent.socketPath') return '/run/firewall.sock';
    return undefined;
  }),
};

describe('FeatureFlagsService', () => {
  it('publishes typed defaults and evaluates hot paths without store I/O', async () => {
    const store = new SettingsStoreStub(settings());
    const service = new FeatureFlagsService(store as never, config as never);
    await service.onModuleInit();
    jest.clearAllMocks();

    expect(service.isEnabled('feature.ocr')).toBe(true);
    expect(service.getState('feature.display-virtual')).toMatchObject({
      enabled: false,
      disablePolicy: 'drain_active',
      lifecycle: 'permanent',
    });
    expect(store.getStoredSettings).not.toHaveBeenCalled();
    expect(store.updateSettings).not.toHaveBeenCalled();
  });

  it('updates multiple flags atomically and rejects stale revisions', async () => {
    const store = new SettingsStoreStub(settings());
    const service = new FeatureFlagsService(store as never, config as never);
    await service.onModuleInit();

    const updated = await service.update({
      revision: 0,
      changes: [
        { key: 'feature.ocr', enabled: false },
        { key: 'feature.image-builder', enabled: false },
      ],
    });
    expect(updated.revision).toBe(1);
    expect(service.isEnabled('feature.ocr')).toBe(false);
    await expect(
      service.update({
        revision: 0,
        changes: [{ key: 'feature.ocr', enabled: true }],
      }),
    ).rejects.toMatchObject({
      response: { code: 'feature_revision_conflict' },
    });
  });

  it('uses stable errors for disabled and unknown features', async () => {
    const store = new SettingsStoreStub(settings());
    const service = new FeatureFlagsService(store as never, config as never);
    await service.onModuleInit();

    expect(() => service.assertEnabled('feature.display-virtual')).toThrow(
      FeatureDisabledException,
    );
    await expect(
      service.update({
        revision: 0,
        changes: [{ key: 'feature.unknown', enabled: true }],
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('restores runtime defaults with a new revision', async () => {
    const store = new SettingsStoreStub(settings());
    const service = new FeatureFlagsService(store as never, config as never);
    await service.onModuleInit();
    await service.update({
      revision: 0,
      changes: [{ key: 'feature.ocr', enabled: false }],
    });

    const reset = await service.reset(1);
    expect(reset.revision).toBe(2);
    expect(service.isEnabled('feature.ocr')).toBe(true);
  });

  it('does not advance the revision for a no-op update', async () => {
    const store = new SettingsStoreStub(settings());
    const service = new FeatureFlagsService(store as never, config as never);
    await service.onModuleInit();

    const unchanged = await service.update({
      revision: 0,
      changes: [{ key: 'feature.ocr', enabled: true }],
    });
    expect(unchanged.revision).toBe(0);
  });
});
