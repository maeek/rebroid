import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { viewerTransport } from '@rebroid/android-application-core/viewer-control';
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
import type { AutomationAiProvider } from './contracts/ai-provider';
import {
  featureFlagDefinitions,
  type FeatureFlagKey,
} from '../feature-flags/feature-flag.registry';

export interface PersistedFeatureFlags {
  revision: number;
  values: Partial<Record<FeatureFlagKey, boolean>>;
}

export type StoredOrchestratorSettings = OrchestratorSettingsDto & {
  aiProviders: AutomationAiProvider[];
  featureFlags: PersistedFeatureFlags;
};

@Injectable()
export class OrchestratorSettingsStore {
  private writeQueue: Promise<void> = Promise.resolve();
  private readonly subscribers = new Set<
    (settings: StoredOrchestratorSettings) => void
  >();

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

  writeSettings(settings: StoredOrchestratorSettings) {
    return this.enqueueWrite(async () => {
      const normalized = this.normalizeSettings(settings);
      await this.persistSettings(normalized);
      return normalized;
    });
  }

  updateSettings(
    update: (
      current: StoredOrchestratorSettings,
    ) => StoredOrchestratorSettings | Promise<StoredOrchestratorSettings>,
  ) {
    return this.enqueueWrite(async () => {
      const current = await this.getStoredSettings();
      const updated = this.normalizeSettings(await update(current));
      await this.persistSettings(updated);
      return updated;
    });
  }

  subscribe(listener: (settings: StoredOrchestratorSettings) => void) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  private async persistSettings(settings: StoredOrchestratorSettings) {
    const path = this.settingsPath();
    const temporaryPath = `${path}.tmp`;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, {
      encoding: 'utf-8',
      mode: 0o600,
    });
    await rename(temporaryPath, path);
    for (const subscriber of this.subscribers) subscriber(settings);
  }

  private enqueueWrite<T>(operation: () => Promise<T>) {
    const pending = this.writeQueue.then(operation, operation);
    this.writeQueue = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  defaults(): StoredOrchestratorSettings {
    return {
      defaultContainerImage: this.config.getOrThrow<string>(
        'app.container.image',
      ),
      dockerImageRegistry: null,
      defaultScrcpyTransport: viewerTransport.WebRTC,
      defaultInactivityTimeoutSeconds: this.config.getOrThrow<number>(
        'app.redroid.defaultInactivityTimeoutSeconds',
      ),
      maxApkUploadSizeMb: this.config.getOrThrow<number>(
        'app.redroid.maxApkUploadSizeMb',
      ),
      services: this.defaultServices(),
      aiProviders: defaultAiProviders(),
      featureFlags: this.defaultFeatureFlags(),
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
      defaultScrcpyTransport: viewerTransport.WebRTC,
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
      featureFlags: this.normalizeFeatureFlags(
        value.featureFlags,
        defaults.featureFlags,
      ),
    };
  }

  toPublicSettings(
    settings: StoredOrchestratorSettings,
  ): OrchestratorSettingsDto {
    const publicSettings = { ...settings };
    delete (publicSettings as Partial<StoredOrchestratorSettings>).aiProviders;
    delete (publicSettings as Partial<StoredOrchestratorSettings>).featureFlags;
    return publicSettings;
  }

  private defaultFeatureFlags(): PersistedFeatureFlags {
    const values: Partial<Record<FeatureFlagKey, boolean>> = {};
    for (const definition of featureFlagDefinitions) {
      if (definition.control !== 'runtime') continue;
      const deploymentSupported =
        definition.key !== 'feature.ocr' ||
        Boolean(this.config.get<string>('app.ocr.baseUrl'));
      values[definition.key] = definition.defaultEnabled && deploymentSupported;
    }
    return { revision: 0, values };
  }

  private normalizeFeatureFlags(
    value: Partial<PersistedFeatureFlags> | undefined,
    defaults: PersistedFeatureFlags,
  ): PersistedFeatureFlags {
    const values = { ...defaults.values };
    for (const definition of featureFlagDefinitions) {
      if (definition.control !== 'runtime') continue;
      const stored = value?.values?.[definition.key];
      if (typeof stored === 'boolean') values[definition.key] = stored;
    }
    const revision = Number.isSafeInteger(value?.revision)
      ? Math.max(0, Number(value?.revision))
      : defaults.revision;
    return { revision, values };
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
        endpoint: ocrEndpoint,
        timeoutMs: this.config.get<number>('app.ocr.timeoutMs') ?? 15_000,
        maxImageDimension:
          this.config.get<number>('app.ocr.maxImageDimension') ?? 1600,
        minConfidence: this.config.get<number>('app.ocr.minConfidence') ?? 0.4,
        language: this.config.get<string>('app.ocr.language')?.trim() || 'en',
      },
      firewall: {
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
      language: value?.language?.trim() || defaults.language,
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
      endpoint,
      timeoutMs: numberInRange(
        value?.timeoutMs,
        defaults.timeoutMs,
        100,
        120000,
      ),
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
}
