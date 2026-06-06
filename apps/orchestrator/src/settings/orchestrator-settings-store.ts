import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ScrcpyTransport } from '../android-apps/android-application-status';
import { numberInRange } from '../common/number-range';
import {
  defaultAiProviders,
  normalizeAiProviders,
} from './ai-provider-settings';
import { OrchestratorSettingsDto } from './dto/orchestrator-settings.dto';
import type { AutomationAiProvider } from '@rebroid/ai-core/provider';

export type StoredOrchestratorSettings = OrchestratorSettingsDto & {
  aiProviders: AutomationAiProvider[];
};

@Injectable()
export class OrchestratorSettingsStore {
  constructor(private readonly config: ConfigService) {}

  async readStoredSettings() {
    try {
      const content = await readFile(this.settingsPath(), 'utf-8');
      return JSON.parse(content) as Partial<StoredOrchestratorSettings>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  async getStoredSettings() {
    return this.normalizeSettings(await this.readStoredSettings());
  }

  async writeSettings(settings: StoredOrchestratorSettings) {
    const path = this.settingsPath();
    const temporaryPath = `${path}.tmp`;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, {
      encoding: 'utf-8',
      mode: 0o600,
    });
    await rename(temporaryPath, path);
  }

  defaults(): StoredOrchestratorSettings {
    return {
      defaultContainerImage: this.config.getOrThrow<string>(
        'app.container.image',
      ),
      dockerImageRegistry: null,
      defaultScrcpyTransport: ScrcpyTransport.WebRTC,
      defaultInactivityTimeoutSeconds: this.config.getOrThrow<number>(
        'app.redroid.defaultInactivityTimeoutSeconds',
      ),
      maxApkUploadSizeMb: this.config.getOrThrow<number>(
        'app.redroid.maxApkUploadSizeMb',
      ),
      aiProviders: defaultAiProviders(),
    };
  }

  normalizeSettings(
    value: Partial<StoredOrchestratorSettings>,
  ): StoredOrchestratorSettings {
    const defaults = this.defaults();
    return {
      defaultContainerImage:
        value.defaultContainerImage?.trim() || defaults.defaultContainerImage,
      dockerImageRegistry: this.normalizeRegistry(
        value.dockerImageRegistry ?? defaults.dockerImageRegistry,
      ),
      defaultScrcpyTransport: ScrcpyTransport.WebRTC,
      defaultInactivityTimeoutSeconds: numberInRange(
        value.defaultInactivityTimeoutSeconds,
        defaults.defaultInactivityTimeoutSeconds,
        -1,
        86400,
      ),
      maxApkUploadSizeMb: numberInRange(
        value.maxApkUploadSizeMb,
        defaults.maxApkUploadSizeMb,
        1,
        512,
      ),
      aiProviders: normalizeAiProviders(value.aiProviders),
    };
  }

  toPublicSettings(
    settings: StoredOrchestratorSettings,
  ): OrchestratorSettingsDto {
    const publicSettings = { ...settings };
    delete (publicSettings as Partial<StoredOrchestratorSettings>).aiProviders;
    return publicSettings;
  }

  private settingsPath() {
    return this.config.getOrThrow<string>('app.settingsPath');
  }

  private normalizeRegistry(value?: string | null) {
    const normalized = value?.trim().replace(/\/+$/, '') ?? '';
    return normalized.length > 0 ? normalized : null;
  }
}
