import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  maskProvider,
  normalizeAiModel,
  normalizeAiProvider,
  normalizeAiProviders,
  normalizeDefaultModel,
  resolveUpdatedApiKey,
} from './ai-provider-settings';
import type {
  AutomationAiProviderModel,
  AutomationAiProviderModelRole,
} from './contracts/ai-provider';
import { AiProviderHealthService } from './ai-provider-health.service';
import { AiProviderModelDownloadService } from './ai-provider-model-download.service';
import { OrchestratorSettingsStore } from './orchestrator-settings-store';
import type {
  CreateAutomationAiProviderDto,
  CreateAutomationAiProviderModelDto,
  UpdateAutomationAiProviderDto,
  UpdateAutomationAiProviderModelDto,
} from './dto/automation-ai-provider.dto';
import type { AutomationAiProviderHealthDto } from './dto/automation-ai-provider-health.dto';

@Injectable()
export class AiProviderSettingsService {
  constructor(
    private readonly store: OrchestratorSettingsStore,
    private readonly aiProviderHealth: AiProviderHealthService,
    private readonly aiProviderModelDownloads: AiProviderModelDownloadService,
  ) {}

  async listProviders() {
    const settings = await this.getStoredSettings();
    return settings.aiProviders.map((provider) => maskProvider(provider));
  }

  async listEnabledModelCatalog() {
    const settings = await this.getStoredSettings();
    return settings.aiProviders
      .filter((provider) => provider.enabled)
      .map((provider) => ({
        id: provider.id,
        label: provider.label,
        kind: provider.kind,
        protocol: provider.protocol,
        serverFlavor: provider.serverFlavor,
        models: provider.models.filter((model) => model.enabled),
      }))
      .filter((provider) => provider.models.length > 0);
  }

  async getProviderForExecution(
    providerId?: string,
    modelId?: string,
    role: AutomationAiProviderModelRole = 'controller',
  ) {
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
    const enabledModels = provider.models.filter(
      (model) => model.enabled && model.roles.includes(role),
    );
    const model = modelId
      ? enabledModels.find((item) => item.id === modelId)
      : (enabledModels.find((item) => item.defaultFor.includes(role)) ??
        enabledModels[0]);
    if (!model) {
      throw new BadRequestException(
        `No enabled ${role} AI model is configured for provider "${provider.id}".`,
      );
    }
    return { provider, model };
  }

  async checkProviderHealth(
    providerId: string,
    modelId?: string,
    role?: AutomationAiProviderModelRole,
  ): Promise<AutomationAiProviderHealthDto> {
    if (
      role &&
      role !== 'controller' &&
      role !== 'planner' &&
      role !== 'vision'
    ) {
      throw new BadRequestException(`Unsupported AI model role "${role}".`);
    }
    const settings = await this.getStoredSettings();
    const provider = settings.aiProviders.find(
      (item) => item.id === providerId,
    );
    if (!provider) {
      throw new NotFoundException(`AI provider "${providerId}" was not found.`);
    }
    return this.aiProviderHealth.checkProviderHealth(provider, modelId, role);
  }

  async checkCandidateHealth(dto: CreateAutomationAiProviderDto) {
    const provider = normalizeAiProvider({
      ...dto,
      enabled: true,
      models: dto.models ?? [],
    });
    return this.aiProviderHealth.checkProviderConnection(provider);
  }

  async listRemoteModels(providerId: string) {
    const settings = await this.getStoredSettings();
    const provider = settings.aiProviders.find(
      (item) => item.id === providerId,
    );
    if (!provider) {
      throw new NotFoundException(`AI provider "${providerId}" was not found.`);
    }
    try {
      return await this.aiProviderHealth.listRemoteModels(provider);
    } catch (error) {
      throw new BadRequestException(this.aiProviderHealth.errorMessage(error));
    }
  }

  async createProvider(dto: CreateAutomationAiProviderDto) {
    const provider = normalizeAiProvider(dto);
    await this.store.updateSettings((settings) => {
      if (settings.aiProviders.some((item) => item.id === provider.id)) {
        throw new BadRequestException(
          `AI provider "${dto.id}" already exists.`,
        );
      }
      return {
        ...settings,
        aiProviders: normalizeAiProviders([...settings.aiProviders, provider]),
      };
    });
    return maskProvider(provider);
  }

  async updateProvider(providerId: string, dto: UpdateAutomationAiProviderDto) {
    let next: ReturnType<typeof normalizeAiProvider> | undefined;
    await this.store.updateSettings((settings) => {
      const index = settings.aiProviders.findIndex(
        (provider) => provider.id === providerId,
      );
      if (index < 0) {
        throw new NotFoundException(
          `AI provider "${providerId}" was not found.`,
        );
      }
      const current = settings.aiProviders[index];
      next = normalizeAiProvider(
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
        settings.aiProviders.some((provider) => provider.id === next?.id)
      ) {
        throw new BadRequestException(
          `AI provider "${next.id}" already exists.`,
        );
      }
      const providers = [...settings.aiProviders];
      providers[index] = next;
      return { ...settings, aiProviders: normalizeAiProviders(providers) };
    });
    if (!next)
      throw new NotFoundException(`AI provider "${providerId}" was not found.`);
    return maskProvider(next);
  }

  async deleteProvider(providerId: string) {
    await this.store.updateSettings((settings) => {
      const next = settings.aiProviders.filter(
        (provider) => provider.id !== providerId,
      );
      if (next.length === settings.aiProviders.length) {
        throw new NotFoundException(
          `AI provider "${providerId}" was not found.`,
        );
      }
      return { ...settings, aiProviders: next };
    });
  }

  async createProviderModel(
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

  async updateProviderModel(
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

  async deleteProviderModel(providerId: string, modelId: string) {
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

  async downloadProviderModel(
    providerId: string,
    modelId: string,
    label?: string,
  ) {
    return this.aiProviderModelDownloads.download(providerId, modelId, label);
  }

  getProviderModelDownload(providerId: string, downloadId: string) {
    return this.aiProviderModelDownloads.get(providerId, downloadId);
  }

  private async getStoredSettings() {
    return this.store.getStoredSettings();
  }

  private async updateProviderModels(
    providerId: string,
    update: (
      models: AutomationAiProviderModel[],
    ) => AutomationAiProviderModel[],
  ) {
    let updatedProvider:
      | Awaited<
          ReturnType<OrchestratorSettingsStore['getStoredSettings']>
        >['aiProviders'][number]
      | undefined;
    await this.store.updateSettings((settings) => {
      const index = settings.aiProviders.findIndex(
        (provider) => provider.id === providerId,
      );
      if (index < 0) {
        throw new NotFoundException(
          `AI provider "${providerId}" was not found.`,
        );
      }
      updatedProvider = {
        ...settings.aiProviders[index],
        models: normalizeDefaultModel(
          update(settings.aiProviders[index].models),
        ),
      };
      const providers = [...settings.aiProviders];
      providers[index] = updatedProvider;
      return { ...settings, aiProviders: providers };
    });
    if (!updatedProvider) {
      throw new NotFoundException(`AI provider "${providerId}" was not found.`);
    }
    return maskProvider(updatedProvider);
  }
}
