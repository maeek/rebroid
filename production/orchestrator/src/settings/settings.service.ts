import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ScrcpyTransport } from '../android-apps/android-application-status';
import { numberInRange } from '../common/number-range';
import { OrchestratorSettingsDto } from './dto/orchestrator-settings.dto';
import { UpdateOrchestratorSettingsDto } from './dto/update-orchestrator-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly config: ConfigService) {}

  async getSettings(): Promise<OrchestratorSettingsDto> {
    const stored = await this.readStoredSettings();
    return this.normalizeSettings(stored);
  }

  async updateSettings(dto: UpdateOrchestratorSettingsDto) {
    const current = await this.getSettings();
    const updated = this.normalizeSettings({ ...current, ...dto });
    await this.writeSettings(updated);
    return updated;
  }

  async resetSettings() {
    const defaults = this.defaults();
    await this.writeSettings(defaults);
    return defaults;
  }

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

  private async readStoredSettings() {
    try {
      const content = await readFile(this.settingsPath(), 'utf-8');
      return JSON.parse(content) as Partial<OrchestratorSettingsDto>;
    } catch {
      return {};
    }
  }

  private async writeSettings(settings: OrchestratorSettingsDto) {
    const path = this.settingsPath();
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(settings, null, 2)}\n`, 'utf-8');
  }

  private normalizeSettings(value: Partial<OrchestratorSettingsDto>) {
    const defaults = this.defaults();
    return {
      defaultContainerImage:
        value.defaultContainerImage?.trim() || defaults.defaultContainerImage,
      defaultScrcpyTransport: ScrcpyTransport.WebSocket,
      defaultInactivityTimeoutSeconds: numberInRange(
        value.defaultInactivityTimeoutSeconds,
        defaults.defaultInactivityTimeoutSeconds,
        60,
        86400,
      ),
      maxApkUploadSizeMb: numberInRange(
        value.maxApkUploadSizeMb,
        defaults.maxApkUploadSizeMb,
        1,
        4096,
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
      defaultScrcpyTransport: ScrcpyTransport.WebSocket,
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
}
