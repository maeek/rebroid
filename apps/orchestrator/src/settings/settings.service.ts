import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ScrcpyTransport } from '../android-apps/android-application-status';
import type { BufferedUploadFile } from '../common/http-upload';
import { numberInRange } from '../common/number-range';
import { OrchestratorSettingsDto } from './dto/orchestrator-settings.dto';
import { UpdateOrchestratorSettingsDto } from './dto/update-orchestrator-settings.dto';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from '../automations/ai/automation-ai.types';
import type {
  AutomationAiProviderHealthDto,
  CreateAutomationAiProviderDto,
  CreateAutomationAiProviderModelDto,
  UpdateAutomationAiProviderDto,
  UpdateAutomationAiProviderModelDto,
} from './dto/automation-ai-provider.dto';

type StoredOrchestratorSettings = OrchestratorSettingsDto & {
  aiProviders: AutomationAiProvider[];
};

const MASKED_API_KEY = '********';

@Injectable()
export class SettingsService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Loads persisted settings and fills in any missing values from config defaults.
   */
  async getSettings(): Promise<OrchestratorSettingsDto> {
    const stored = await this.readStoredSettings();
    const normalized = this.normalizeSettings(stored);
    return this.toPublicSettings(normalized);
  }

  /**
   * Merges partial updates through normalization so persisted values always stay in range.
   */
  async updateSettings(dto: UpdateOrchestratorSettingsDto) {
    const current = await this.getStoredSettings();
    const updated = this.normalizeSettings({ ...current, ...dto });
    await this.writeSettings(updated);
    return this.toPublicSettings(updated);
  }

  /**
   * Restores settings to config-backed defaults and overwrites the stored file.
   */
  async resetSettings() {
    const defaults = this.defaults();
    await this.writeSettings(defaults);
    return this.toPublicSettings(defaults);
  }

  /**
   * Enforces the current APK upload size limit.
   * This is a no-op when no file object is provided.
   */
  async assertApkSizeAllowed(file?: Pick<BufferedUploadFile, 'size'>) {
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

  async listAiProviders() {
    const settings = await this.getStoredSettings();
    return settings.aiProviders.map((provider) => this.maskProvider(provider));
  }

  async listEnabledAiModelCatalog() {
    const settings = await this.getStoredSettings();
    return settings.aiProviders
      .filter((provider) => provider.enabled)
      .map((provider) => ({
        id: provider.id,
        label: provider.label,
        kind: provider.kind,
        models: provider.models.filter((model) => model.enabled),
      }))
      .filter((provider) => provider.models.length > 0);
  }

  async getAiProviderForExecution(providerId?: string, modelId?: string) {
    const settings = await this.getStoredSettings();
    const providers = settings.aiProviders.filter(
      (provider) => provider.enabled,
    );
    const provider = providerId
      ? providers.find((item) => item.id === providerId)
      : providers[0];
    if (!provider) {
      throw new BadRequestException(
        'No enabled AI provider is configured for automations.',
      );
    }
    const enabledModels = provider.models.filter((model) => model.enabled);
    const model = modelId
      ? enabledModels.find((item) => item.id === modelId)
      : enabledModels.find((item) => item.default) ?? enabledModels[0];
    if (!model) {
      throw new BadRequestException(
        `No enabled AI model is configured for provider "${provider.id}".`,
      );
    }
    if (!model.supportsTools) {
      throw new BadRequestException(
        `AI model "${model.id}" is not enabled for tool-calling automations.`,
      );
    }
    return { provider, model };
  }

  async checkAiProviderHealth(
    providerId: string,
    modelId?: string,
  ): Promise<AutomationAiProviderHealthDto> {
    const settings = await this.getStoredSettings();
    const provider = settings.aiProviders.find((item) => item.id === providerId);
    if (!provider) {
      throw new NotFoundException(`AI provider "${providerId}" was not found.`);
    }
    const model = modelId
      ? provider.models.find((item) => item.id === modelId)
      : provider.models.find((item) => item.enabled && item.default) ??
        provider.models.find((item) => item.enabled);
    if (modelId && !model) {
      throw new NotFoundException(
        `AI model "${modelId}" was not found for provider "${providerId}".`,
      );
    }
    if (!provider.enabled) {
      return this.aiProviderHealthResult(
        provider.id,
        model?.id,
        'disabled',
        'Provider is disabled.',
      );
    }
    if (model && !model.enabled) {
      return this.aiProviderHealthResult(
        provider.id,
        model.id,
        'disabled',
        'Model is disabled.',
      );
    }

    try {
      const response = await fetch(this.aiProviderModelsUrl(provider), {
        headers: provider.apiKey
          ? { Authorization: `Bearer ${provider.apiKey}` }
          : undefined,
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return this.aiProviderHealthResult(
          provider.id,
          model?.id,
          'error',
          `Provider returned HTTP ${response.status}.`,
        );
      }
      const body = (await response.json().catch(() => null)) as
        | { data?: Array<{ id?: unknown }> }
        | null;
      const remoteModelIds = new Set(
        Array.isArray(body?.data)
          ? body.data
              .map((item) => (typeof item.id === 'string' ? item.id : ''))
              .filter(Boolean)
          : [],
      );
      if (model && remoteModelIds.size > 0 && !remoteModelIds.has(model.id)) {
        return this.aiProviderHealthResult(
          provider.id,
          model.id,
          'error',
          `Provider is reachable, but model "${model.id}" was not listed.`,
        );
      }
      return this.aiProviderHealthResult(
        provider.id,
        model?.id,
        'ok',
        model
          ? `Provider is reachable and model "${model.id}" is available.`
          : 'Provider is reachable.',
      );
    } catch (error) {
      return this.aiProviderHealthResult(
        provider.id,
        model?.id,
        'error',
        this.aiProviderHealthErrorMessage(error),
      );
    }
  }

  async createAiProvider(dto: CreateAutomationAiProviderDto) {
    const settings = await this.getStoredSettings();
    if (settings.aiProviders.some((provider) => provider.id === dto.id.trim())) {
      throw new BadRequestException(`AI provider "${dto.id}" already exists.`);
    }
    const provider = this.normalizeAiProvider(dto);
    settings.aiProviders = this.normalizeAiProviders([
      ...settings.aiProviders,
      provider,
    ]);
    await this.writeSettings(settings);
    return this.maskProvider(provider);
  }

  async updateAiProvider(providerId: string, dto: UpdateAutomationAiProviderDto) {
    const settings = await this.getStoredSettings();
    const index = settings.aiProviders.findIndex(
      (provider) => provider.id === providerId,
    );
    if (index < 0) {
      throw new NotFoundException(`AI provider "${providerId}" was not found.`);
    }
    const current = settings.aiProviders[index];
    const next = this.normalizeAiProvider(
      {
        ...current,
        ...dto,
        id: dto.id ?? current.id,
        apiKey: this.resolveUpdatedApiKey(current.apiKey, dto.apiKey),
        models: dto.models ?? current.models,
      },
      current,
    );
    if (
      next.id !== providerId &&
      settings.aiProviders.some((provider) => provider.id === next.id)
    ) {
      throw new BadRequestException(`AI provider "${next.id}" already exists.`);
    }
    settings.aiProviders[index] = next;
    settings.aiProviders = this.normalizeAiProviders(settings.aiProviders);
    await this.writeSettings(settings);
    return this.maskProvider(next);
  }

  async deleteAiProvider(providerId: string) {
    const settings = await this.getStoredSettings();
    const next = settings.aiProviders.filter(
      (provider) => provider.id !== providerId,
    );
    if (next.length === settings.aiProviders.length) {
      throw new NotFoundException(`AI provider "${providerId}" was not found.`);
    }
    settings.aiProviders = next;
    await this.writeSettings(settings);
  }

  async createAiProviderModel(
    providerId: string,
    dto: CreateAutomationAiProviderModelDto,
  ) {
    const provider = await this.updateProviderModels(providerId, (models) => {
      if (models.some((model) => model.id === dto.id.trim())) {
        throw new BadRequestException(
          `AI model "${dto.id}" already exists for provider "${providerId}".`,
        );
      }
      return [...models, this.normalizeAiModel(dto)];
    });
    return provider.models.find((model) => model.id === dto.id.trim());
  }

  async updateAiProviderModel(
    providerId: string,
    modelId: string,
    dto: UpdateAutomationAiProviderModelDto,
  ) {
    const provider = await this.updateProviderModels(providerId, (models) => {
      const index = models.findIndex((model) => model.id === modelId);
      if (index < 0) {
        throw new NotFoundException(
          `AI model "${modelId}" was not found for provider "${providerId}".`,
        );
      }
      const next = this.normalizeAiModel({
        ...models[index],
        ...dto,
        id: dto.id ?? models[index].id,
      });
      if (
        next.id !== modelId &&
        models.some((model) => model.id === next.id)
      ) {
        throw new BadRequestException(
          `AI model "${next.id}" already exists for provider "${providerId}".`,
        );
      }
      const updated = [...models];
      updated[index] = next;
      return updated;
    });
    const nextId = dto.id?.trim() || modelId;
    return provider.models.find((model) => model.id === nextId);
  }

  async deleteAiProviderModel(providerId: string, modelId: string) {
    await this.updateProviderModels(providerId, (models) => {
      const next = models.filter((model) => model.id !== modelId);
      if (next.length === models.length) {
        throw new NotFoundException(
          `AI model "${modelId}" was not found for provider "${providerId}".`,
        );
      }
      return next;
    });
  }

  private async readStoredSettings() {
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

  private async getStoredSettings() {
    return this.normalizeSettings(await this.readStoredSettings());
  }

  private async writeSettings(settings: StoredOrchestratorSettings) {
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
  private normalizeSettings(
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
      aiProviders: this.normalizeAiProviders(value.aiProviders),
    };
  }

  private defaults(): StoredOrchestratorSettings {
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
      aiProviders: [
        {
          id: 'local-ollama',
          label: 'Local Ollama',
          kind: 'ollama',
          baseUrl: 'http://localhost:11434',
          apiKey: null,
          models: [
            {
              id: 'qwen2.5vl:7b',
              label: 'Qwen 2.5 VL 7B',
              supportsVision: true,
              supportsTools: true,
              enabled: true,
              default: true,
            },
            {
              id: 'qwen2.5:7b',
              label: 'Qwen 2.5 7B',
              supportsVision: false,
              supportsTools: true,
              enabled: true,
              default: false,
            },
          ],
          enabled: false,
        },
      ],
    };
  }

  private settingsPath() {
    return this.config.getOrThrow<string>('app.settingsPath');
  }

  private normalizeRegistry(value?: string | null) {
    const normalized = value?.trim().replace(/\/+$/, '') ?? '';
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeAiProviders(value: unknown) {
    if (!Array.isArray(value)) {
      return this.defaults().aiProviders;
    }
    const seen = new Set<string>();
    const providers: AutomationAiProvider[] = [];
    for (const rawProvider of value) {
      let normalized: AutomationAiProvider;
      try {
        normalized = this.normalizeAiProvider(rawProvider);
      } catch {
        continue;
      }
      if (!normalized || seen.has(normalized.id)) {
        continue;
      }
      seen.add(normalized.id);
      providers.push(normalized);
    }
    return providers;
  }

  private normalizeAiProvider(
    rawProvider: unknown,
    fallback?: AutomationAiProvider,
  ): AutomationAiProvider {
    if (
      !rawProvider ||
      typeof rawProvider !== 'object' ||
      Array.isArray(rawProvider)
    ) {
      throw new BadRequestException('AI provider must be an object.');
    }
    const provider = rawProvider as Record<string, unknown>;
    const id = text(provider.id) || fallback?.id || '';
    const label = text(provider.label) || fallback?.label || id;
    const kind = text(provider.kind) || fallback?.kind || '';
    const baseUrl = text(provider.baseUrl || fallback?.baseUrl).replace(
      /\/+$/,
      '',
    );
    const models = this.normalizeAiModels(
      provider.models ?? fallback?.models ?? [],
    );
    if (
      !id ||
      !label ||
      !baseUrl ||
      !['openai', 'openai-compatible', 'ollama'].includes(kind)
    ) {
      throw new BadRequestException('AI provider has invalid configuration.');
    }
    return {
      id,
      label,
      kind: kind as AutomationAiProvider['kind'],
      baseUrl:
        kind === 'openai' && baseUrl === 'https://api.openai.com'
          ? 'https://api.openai.com/v1'
          : baseUrl,
      apiKey:
        provider.apiKey === null ? null : text(provider.apiKey) || null,
      models,
      enabled: provider.enabled !== false,
    };
  }

  private normalizeAiModels(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }
    const seen = new Set<string>();
    const models: AutomationAiProviderModel[] = [];
    for (const rawModel of value) {
      const model = this.normalizeAiModel(rawModel);
      if (!model || seen.has(model.id)) {
        continue;
      }
      seen.add(model.id);
      models.push(model);
    }
    return this.normalizeDefaultModel(models);
  }

  private normalizeAiModel(rawModel: unknown): AutomationAiProviderModel {
    if (!rawModel || typeof rawModel !== 'object' || Array.isArray(rawModel)) {
      throw new BadRequestException('AI provider model must be an object.');
    }
    const model = rawModel as Record<string, unknown>;
    const id = text(model.id);
    const label = text(model.label) || id;
    if (!id || !label) {
      throw new BadRequestException('AI provider model has invalid identity.');
    }
    return {
      id,
      label,
      supportsVision: model.supportsVision !== false,
      supportsTools: model.supportsTools !== false,
      enabled: model.enabled !== false,
      default: model.default === true,
    };
  }

  private normalizeDefaultModel(models: AutomationAiProviderModel[]) {
    let defaultAssigned = false;
    const enabledDefaultIndex = models.findIndex(
      (model) => model.enabled && model.default,
    );
    const fallbackDefaultIndex = models.findIndex((model) => model.enabled);
    const defaultIndex =
      enabledDefaultIndex >= 0 ? enabledDefaultIndex : fallbackDefaultIndex;
    return models.map((model, index) => {
      const isDefault = index === defaultIndex && !defaultAssigned;
      defaultAssigned ||= isDefault;
      return { ...model, default: isDefault };
    });
  }

  private resolveUpdatedApiKey(
    current: string | null | undefined,
    next: string | null | undefined,
  ) {
    if (next === undefined || next === MASKED_API_KEY) {
      return current ?? null;
    }
    return text(next) || null;
  }

  private maskProvider(provider: AutomationAiProvider) {
    return {
      ...provider,
      apiKey: provider.apiKey ? MASKED_API_KEY : null,
    };
  }

  private aiProviderModelsUrl(provider: AutomationAiProvider) {
    if (provider.kind === 'ollama') {
      return `${provider.baseUrl.replace(/\/+$/, '')}/v1/models`;
    }
    return `${provider.baseUrl.replace(/\/+$/, '')}/models`;
  }

  private aiProviderHealthResult(
    providerId: string,
    modelId: string | undefined,
    status: AutomationAiProviderHealthDto['status'],
    message: string,
  ): AutomationAiProviderHealthDto {
    return {
      providerId,
      ...(modelId ? { modelId } : {}),
      status,
      message,
      checkedAt: new Date().toISOString(),
    };
  }

  private aiProviderHealthErrorMessage(error: unknown) {
    if (!(error instanceof Error)) return 'Provider health check failed.';

    const cause = error.cause;
    if (!cause || typeof cause !== 'object') return error.message;

    const causeRecord = cause as {
      address?: unknown;
      code?: unknown;
      message?: unknown;
      port?: unknown;
    };
    const details = [
      typeof causeRecord.message === 'string' ? causeRecord.message : '',
      typeof causeRecord.code === 'string' ? causeRecord.code : '',
      typeof causeRecord.address === 'string' ? causeRecord.address : '',
      typeof causeRecord.port === 'number' ? String(causeRecord.port) : '',
    ].filter(Boolean);
    const uniqueDetails = Array.from(new Set(details));

    return uniqueDetails.length > 0
      ? `${error.message}: ${uniqueDetails.join(' ')}`
      : error.message;
  }

  private toPublicSettings(
    settings: StoredOrchestratorSettings,
  ): OrchestratorSettingsDto {
    const publicSettings = { ...settings };
    delete (publicSettings as Partial<StoredOrchestratorSettings>).aiProviders;
    return publicSettings;
  }

  private async updateProviderModels(
    providerId: string,
    update: (
      models: AutomationAiProviderModel[],
    ) => AutomationAiProviderModel[],
  ) {
    const settings = await this.getStoredSettings();
    const index = settings.aiProviders.findIndex(
      (provider) => provider.id === providerId,
    );
    if (index < 0) {
      throw new NotFoundException(`AI provider "${providerId}" was not found.`);
    }
    const provider = settings.aiProviders[index];
    const updatedProvider = {
      ...provider,
      models: this.normalizeDefaultModel(update(provider.models)),
    };
    settings.aiProviders[index] = updatedProvider;
    await this.writeSettings(settings);
    return this.maskProvider(updatedProvider);
  }
}

const text = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';
