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

  it('starts optional runtime features disabled when their deployment support is absent', () => {
    const unsupportedStore = new OrchestratorSettingsStore(
      new ConfigService({
        app: {
          container: { image: 'rebroid:test' },
          redroid: {
            defaultInactivityTimeoutSeconds: 900,
            maxApkUploadSizeMb: 64,
          },
        },
      }),
    );
    expect(unsupportedStore.defaults().featureFlags.values).toMatchObject({
      'feature.ocr': false,
      'feature.firewall': false,
      'feature.workflows': true,
      'feature.ai': false,
    });
  });

  it('serializes concurrent read-modify-write updates without losing fields', async () => {
    const settings = new SettingsService(store, {} as never);
    await expect(settings.readAndroidRendering()).resolves.toEqual({
      mode: 'software',
      renderDevice: null,
    });
    await Promise.all([
      settings.updateSettings({
        androidRendering: { mode: 'host', renderDevice: '/dev/dri/renderD128' },
        defaultContainerImage: 'rebroid:first',
      }),
      store.updateSettings((current) => ({
        ...current,
        maxApkUploadSizeMb: 128,
      })),
    ]);

    const stored = JSON.parse(await readFile(settingsPath, 'utf8'));
    expect(stored.defaultContainerImage).toBe('rebroid:first');
    expect(stored.maxApkUploadSizeMb).toBe(128);
    expect(stored.featureFlags.revision).toBe(0);
    await expect(settings.readAndroidRendering()).resolves.toEqual({
      mode: 'host',
      renderDevice: '/dev/dri/renderD128',
    });
    await expect(settings.getSettings()).resolves.toMatchObject({
      androidRendering: { mode: 'host', renderDevice: '/dev/dri/renderD128' },
      defaultContainerImage: 'rebroid:first',
    });
  });

  it('restores runtime defaults and connections while preserving unrelated settings', async () => {
    const settings = new SettingsService(store, {} as never);
    const defaults = store.normalizeSettings(store.defaults());
    const configured = await store.writeSettings({
      ...defaults,
      androidRendering: { mode: 'host', renderDevice: '/dev/dri/renderD128' },
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
      store.toPublicSettings({
        ...defaults,
        androidRendering: configured.androidRendering,
      }),
    );
    await expect(store.getStoredSettings()).resolves.toEqual({
      ...defaults,
      androidRendering: configured.androidRendering,
      aiProviders: configured.aiProviders,
      featureFlags: configured.featureFlags,
      dockerOperationLimits: configured.dockerOperationLimits,
    });
  });

  it('preserves independent OCR and firewall updates', async () => {
    const settings = new SettingsService(store, {} as never);
    const ocr = {
      ...store.defaults().services.ocr,
      endpoint: 'http://custom-ocr.test',
      minConfidence: 0.65,
    };
    const firewall = { endpoint: '/run/custom-firewall.sock', timeoutMs: 6000 };
    await Promise.all([
      settings.updateSettings({ services: { ocr } }),
      settings.updateSettings({ services: { firewall } }),
    ]);
    await expect(settings.getSettings()).resolves.toMatchObject({
      services: { ocr, firewall },
    });
  });
});
