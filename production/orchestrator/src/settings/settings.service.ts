import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ScrcpyTransport } from '../android-apps/android-application-status';
import { numberInRange } from '../common/number-range';
import { OrchestratorSettingsDto } from './dto/orchestrator-settings.dto';
import { UpdateOrchestratorSettingsDto } from './dto/update-orchestrator-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Loads persisted settings and fills in any missing values from config defaults.
   */
  async getSettings(): Promise<OrchestratorSettingsDto> {
    const stored = await this.readStoredSettings();
    return this.normalizeSettings(stored);
  }

  /**
   * Merges partial updates through normalization so persisted values always stay in range.
   */
  async updateSettings(dto: UpdateOrchestratorSettingsDto) {
    const current = await this.getSettings();
    const updated = this.normalizeSettings({ ...current, ...dto });
    await this.writeSettings(updated);
    return updated;
  }

  /**
   * Restores settings to config-backed defaults and overwrites the stored file.
   */
  async resetSettings() {
    const defaults = this.defaults();
    await this.writeSettings(defaults);
    return defaults;
  }

  /**
   * Enforces the current APK upload size limit.
   * This is a no-op when no file object is provided.
   */
  async assertApkSizeAllowed(file?: Express.Multer.File) {
    if (!file) {
      return;
    }

    const settings = await this.getSettings();
    const maxBytes = settings.maxApkUploadSizeMb * 1024 * 1024;

    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(
        `APK exceeds configured upload limit of ${settings.maxApkUploadSizeMb} MB.`,
      );
    }
  }

  async getMaxApkUploadBytes() {
    const settings = await this.getSettings();
    return settings.maxApkUploadSizeMb * 1024 * 1024;
  }

  private async readStoredSettings() {
    try {
      const content = await readFile(this.settingsPath(), 'utf-8');
      return JSON.parse(content) as Partial<OrchestratorSettingsDto>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  private async writeSettings(settings: OrchestratorSettingsDto) {
    const path = this.settingsPath();
    const temporaryPath = `${path}.tmp`;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, {
      encoding: 'utf-8',
      mode: 0o600,
    });
    await rename(temporaryPath, path);
  }

  /**
   * Normalizes persisted values and clamps numeric settings to safe ranges.
   */
  private normalizeSettings(value: Partial<OrchestratorSettingsDto>) {
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
      imagePruneIntervalHours: numberInRange(
        value.imagePruneIntervalHours,
        defaults.imagePruneIntervalHours,
        0,
        8760,
      ),
      imagePruneDanglingOnly:
        typeof value.imagePruneDanglingOnly === 'boolean'
          ? value.imagePruneDanglingOnly
          : defaults.imagePruneDanglingOnly,
    };
  }

  private defaults(): OrchestratorSettingsDto {
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
      imagePruneIntervalHours: 24,
      imagePruneDanglingOnly: true,
    };
  }

  private settingsPath() {
    return this.config.getOrThrow<string>('app.settingsPath');
  }

  private normalizeRegistry(value?: string | null) {
    const normalized = value?.trim().replace(/\/+$/, '') ?? '';
    return normalized.length > 0 ? normalized : null;
  }
}
