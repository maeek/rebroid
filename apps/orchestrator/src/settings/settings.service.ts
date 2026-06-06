import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { BufferedUploadFile } from '../common/http-upload';
import {
  maskProvider,
  normalizeAiModel,
  normalizeAiProvider,
  normalizeAiProviders,
  normalizeDefaultModel,
  resolveUpdatedApiKey,
} from './ai-provider-settings';
import { AiProviderHealthService } from './ai-provider-health.service';
import { AiProviderModelDownloadService } from './ai-provider-model-download.service';
import { OrchestratorSettingsDto } from './dto/orchestrator-settings.dto';
import { OrchestratorSettingsStore } from './orchestrator-settings-store';
import { UpdateOrchestratorSettingsDto } from './dto/update-orchestrator-settings.dto';
import type { AutomationAiProviderModel } from '../automations/ai/automation-ai.types';
import type {
  AutomationAiProviderHealthDto,
  CreateAutomationAiProviderDto,
  CreateAutomationAiProviderModelDto,
  UpdateAutomationAiProviderDto,
  UpdateAutomationAiProviderModelDto,
} from './dto/automation-ai-provider.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly store: OrchestratorSettingsStore,
    private readonly aiProviderHealth: AiProviderHealthService,
    private readonly aiProviderModelDownloads: AiProviderModelDownloadService,
  ) {}

  /**
   * Loads persisted settings and fills in any missing values from config defaults.
   */
  async getSettings(): Promise<OrchestratorSettingsDto> {
    const stored = await this.store.readStoredSettings();
    const normalized = this.store.normalizeSettings(stored);
    return this.store.toPublicSettings(normalized);
  }

  /**
   * Merges partial updates through normalization so persisted values always stay in range.
   */
  async updateSettings(dto: UpdateOrchestratorSettingsDto) {
    const current = await this.getStoredSettings();
    const updated = this.store.normalizeSettings({ ...current, ...dto });
    await this.writeSettings(updated);
    return this.store.toPublicSettings(updated);
  }

  /**
   * Restores settings to config-backed defaults and overwrites the stored file.
   */
  async resetSettings() {
    const defaults = this.store.defaults();
    await this.writeSettings(defaults);
    return this.store.toPublicSettings(defaults);
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
    return settings.aiProviders.map((provider) => maskProvider(provider));
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
      : (enabledModels.find((item) => item.default) ?? enabledModels[0]);
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
    const provider = settings.aiProviders.find(
      (item) => item.id === providerId,
    );
    if (!provider) {
      throw new NotFoundException(`AI provider "${providerId}" was not found.`);
    }
    return this.aiProviderHealth.checkProviderHealth(provider, modelId);
  }

  async checkAiProviderCandidateHealth(dto: CreateAutomationAiProviderDto) {
    const provider = normalizeAiProvider({
      ...dto,
      enabled: true,
      models: dto.models ?? [],
    });
    return this.aiProviderHealth.checkProviderConnection(provider);
  }

  async createAiProvider(dto: CreateAutomationAiProviderDto) {
    const settings = await this.getStoredSettings();
    if (
      settings.aiProviders.some((provider) => provider.id === dto.id.trim())
    ) {
      throw new BadRequestException(`AI provider "${dto.id}" already exists.`);
    }
    const provider = normalizeAiProvider(dto);
    settings.aiProviders = normalizeAiProviders([
      ...settings.aiProviders,
      provider,
    ]);
    await this.writeSettings(settings);
    return maskProvider(provider);
  }

  async updateAiProvider(
    providerId: string,
    dto: UpdateAutomationAiProviderDto,
  ) {
    const settings = await this.getStoredSettings();
    const index = settings.aiProviders.findIndex(
      (provider) => provider.id === providerId,
    );
    if (index < 0) {
      throw new NotFoundException(`AI provider "${providerId}" was not found.`);
    }
    const current = settings.aiProviders[index];
    const next = normalizeAiProvider(
      {
        ...current,
        ...dto,
        id: dto.id ?? current.id,
        apiKey: resolveUpdatedApiKey(current.apiKey, dto.apiKey),
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
    settings.aiProviders = normalizeAiProviders(settings.aiProviders);
    await this.writeSettings(settings);
    return maskProvider(next);
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
      return [...models, normalizeAiModel(dto)];
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
      const next = normalizeAiModel({
        ...models[index],
        ...dto,
        id: dto.id ?? models[index].id,
      });
      if (next.id !== modelId && models.some((model) => model.id === next.id)) {
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

  async downloadAiProviderModel(
    providerId: string,
    modelId: string,
    label?: string,
  ) {
    return this.aiProviderModelDownloads.download(providerId, modelId, label);
  }

  getAiProviderModelDownload(providerId: string, downloadId: string) {
    return this.aiProviderModelDownloads.get(providerId, downloadId);
  }

  private async getStoredSettings() {
    return this.store.getStoredSettings();
  }

  private async writeSettings(
    settings: Awaited<
      ReturnType<OrchestratorSettingsStore['getStoredSettings']>
    >,
  ) {
    await this.store.writeSettings(settings);
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
      models: normalizeDefaultModel(update(provider.models)),
    };
    settings.aiProviders[index] = updatedProvider;
    await this.writeSettings(settings);
    return maskProvider(updatedProvider);
  }
}
