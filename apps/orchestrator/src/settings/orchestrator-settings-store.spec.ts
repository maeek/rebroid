import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrchestratorSettingsStore } from './orchestrator-settings-store';

describe('OrchestratorSettingsStore', () => {
  it('serializes concurrent read-modify-write updates without losing fields', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rebroid-settings-'));
    const settingsPath = join(directory, 'settings.json');
    const values: Record<string, unknown> = {
      'app.settingsPath': settingsPath,
      'app.container.image': 'rebroid:test',
      'app.redroid.defaultInactivityTimeoutSeconds': 900,
      'app.redroid.maxApkUploadSizeMb': 64,
      'app.ocr.baseUrl': 'http://ocr.test',
      'app.ocr.timeoutMs': 15_000,
      'app.ocr.maxImageDimension': 1_600,
      'app.ocr.minConfidence': 0.4,
      'app.ocr.language': 'en',
      'app.firewallAgent.socketPath': '/run/firewall.sock',
    };
    const config = {
      get: (key: string) => values[key],
      getOrThrow: (key: string) => {
        const value = values[key];
        if (value === undefined) throw new Error(`Missing ${key}`);
        return value;
      },
    };
    const store = new OrchestratorSettingsStore(config as never);

    try {
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
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
