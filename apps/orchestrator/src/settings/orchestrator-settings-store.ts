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
import {
  OcrServiceSettingsDto,
  OptionalServiceSettingsDto,
  OptionalServicesSettingsDto,
  OrchestratorSettingsDto,
} from './dto/orchestrator-settings.dto';
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
      services: this.defaultServices(),
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
      services: this.normalizeServices(value.services, defaults.services),
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

  private defaultServices(): OptionalServicesSettingsDto {
    const ocrEndpoint = this.normalizeHttpEndpoint(
      this.config.get<string>('app.ocr.baseUrl') ?? null,
    );
    return {
      ocr: {
        enabled:
          Boolean(ocrEndpoint) &&
          (this.config.get<boolean>('app.ocr.enabled') ?? false),
        endpoint: ocrEndpoint,
        timeoutMs: this.config.get<number>('app.ocr.timeoutMs') ?? 15_000,
        maxImageDimension:
          this.config.get<number>('app.ocr.maxImageDimension') ?? 1600,
        minConfidence: this.config.get<number>('app.ocr.minConfidence') ?? 0.4,
        languages: this.normalizeStringList(
          this.config.get<string[]>('app.ocr.languages'),
          ['en'],
        ),
        preprocessingModes: this.normalizeStringList(
          this.config.get<string[]>('app.ocr.preprocessingModes'),
          ['raw', 'grayscale', 'contrast', 'threshold'],
        ),
      },
      firewall: {
        enabled: true,
        endpoint: this.normalizePlainEndpoint(
          this.config.get<string>('app.firewallAgent.socketPath') ?? null,
        ),
        timeoutMs: 5_000,
      },
    };
  }

  private normalizeServices(
    value: Partial<OptionalServicesSettingsDto> | undefined,
    defaults: OptionalServicesSettingsDto,
  ): OptionalServicesSettingsDto {
    return {
      ocr: this.normalizeOcrService(value?.ocr, defaults.ocr),
      firewall: this.normalizeOptionalService(
        value?.firewall,
        defaults.firewall,
        'plain',
      ),
    };
  }

  private normalizeOcrService(
    value: Partial<OcrServiceSettingsDto> | undefined,
    defaults: OcrServiceSettingsDto,
  ): OcrServiceSettingsDto {
    const base = this.normalizeOptionalService(value, defaults, 'http');
    return {
      ...base,
      maxImageDimension: numberInRange(
        value?.maxImageDimension,
        defaults.maxImageDimension,
        320,
        4096,
      ),
      minConfidence: numberInRange(
        value?.minConfidence,
        defaults.minConfidence,
        0,
        1,
      ),
      languages: this.normalizeStringList(value?.languages, defaults.languages),
      preprocessingModes: this.normalizeStringList(
        value?.preprocessingModes,
        defaults.preprocessingModes,
      ),
    };
  }

  private normalizeOptionalService(
    value: Partial<OptionalServiceSettingsDto> | undefined,
    defaults: OptionalServiceSettingsDto,
    endpointKind: 'http' | 'plain',
  ): OptionalServiceSettingsDto {
    const endpoint =
      endpointKind === 'http'
        ? this.normalizeHttpEndpoint(value?.endpoint ?? defaults.endpoint)
        : this.normalizePlainEndpoint(value?.endpoint ?? defaults.endpoint);
    return {
      enabled:
        typeof value?.enabled === 'boolean' ? value.enabled : defaults.enabled,
      endpoint,
      timeoutMs: numberInRange(value?.timeoutMs, defaults.timeoutMs, 100, 120000),
    };
  }

  private normalizeHttpEndpoint(value?: string | null) {
    const normalized = value?.trim().replace(/\/+$/, '') ?? '';
    if (!normalized) return null;
    try {
      const url = new URL(normalized);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }
      return url.toString().replace(/\/+$/, '');
    } catch {
      return null;
    }
  }

  private normalizePlainEndpoint(value?: string | null) {
    const normalized = value?.trim() ?? '';
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeStringList(value: unknown, fallback: string[]) {
    if (!Array.isArray(value)) return fallback;
    const normalized = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
    return normalized.length > 0 ? Array.from(new Set(normalized)) : fallback;
  }
}
