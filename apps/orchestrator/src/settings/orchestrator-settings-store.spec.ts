import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { normalizeAiModel } from './ai-provider-settings';
import { OrchestratorSettingsStore } from './orchestrator-settings-store';
import { SettingsService } from './settings.service';

describe('OrchestratorSettingsStore', () => {
  let directory: string;
  let settingsPath: string;
  let store: OrchestratorSettingsStore;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'rebroid-settings-'));
    settingsPath = join(directory, 'settings.json');
    store = new OrchestratorSettingsStore(
      new ConfigService({
        app: {
          settingsPath,
          container: { image: 'rebroid:test' },
          redroid: {
            defaultInactivityTimeoutSeconds: 900,
            maxApkUploadSizeMb: 64,
          },
          ocr: { baseUrl: 'http://ocr.test' },
          firewallAgent: { socketPath: '/run/firewall.sock' },
        },
      }),
    );
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('serializes concurrent read-modify-write updates without losing fields', async () => {
    await Promise.all([
      store.updateSettings((current) => ({
        ...current,
        defaultContainerImage: 'rebroid:first',
      })),
      store.updateSettings((current) => ({
        ...current,
        maxApkUploadSizeMb: 128,
      })),
    ]);

    const stored = JSON.parse(await readFile(settingsPath, 'utf8'));
    expect(stored.defaultContainerImage).toBe('rebroid:first');
    expect(stored.maxApkUploadSizeMb).toBe(128);
    expect(stored.featureFlags.revision).toBe(0);
  });

  it('restores runtime defaults and connections while preserving unrelated settings', async () => {
    const settings = new SettingsService(store, {} as never);
    const defaults = store.normalizeSettings(store.defaults());
    const configured = await store.writeSettings({
      ...defaults,
      defaultContainerImage: 'rebroid:custom',
      dockerImageRegistry: 'registry.test',
      defaultInactivityTimeoutSeconds: 300,
      maxApkUploadSizeMb: 256,
      services: {
        ocr: { ...defaults.services.ocr, endpoint: 'http://custom-ocr.test' },
        firewall: { endpoint: '/run/custom-firewall.sock', timeoutMs: 6000 },
      },
      aiProviders: [
        {
          id: 'custom',
          label: 'Custom provider',
          kind: 'openai-compatible',
          protocol: 'openai-chat-completions',
          serverFlavor: 'auto',
          baseUrl: 'https://provider.test/v1',
          apiKey: 'test-credential',
          enabled: true,
          models: [
            normalizeAiModel({
              id: 'controller-v1',
              label: 'Controller',
              enabled: true,
              roles: ['controller'],
              defaultFor: ['controller'],
            }),
          ],
        },
      ],
      featureFlags: { revision: 5, values: { 'feature.ocr': false } },
      dockerOperationLimits: {
        maxConcurrentReads: 4,
        maxConcurrentLongOperations: 2,
        slowRequestWarningMs: 500,
        longOperationTimeoutMs: 5000,
      },
    });

    await expect(settings.resetSettings()).resolves.toEqual(
      store.toPublicSettings(defaults),
    );
    await expect(store.getStoredSettings()).resolves.toEqual({
      ...defaults,
      aiProviders: configured.aiProviders,
      featureFlags: configured.featureFlags,
      dockerOperationLimits: configured.dockerOperationLimits,
    });
  });
});
