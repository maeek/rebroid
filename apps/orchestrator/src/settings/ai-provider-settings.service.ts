import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { text } from './ai-provider-values';
import { replaceAiProvider, requireAiProvider } from './ai-provider-catalog';
import { aiProviderErrorMessage } from './utils/ai-provider-health.utils';
import { isOfficialOpenAiProvider } from '../common/ai-provider-request';
import { getOpenAiBillingIssue } from '../common/openai-billing';
import {
  maskProvider,
  normalizeAiModel,
  normalizeAiProvider,
  normalizeDefaultModel,
  resolveUpdatedApiKey,
} from './ai-provider-settings';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
  AutomationAiProviderModelRole,
} from './contracts/ai-provider';
import { AiProviderHealthService } from './ai-provider-health.service';
import { AiProviderModelDownloadService } from './ai-provider-model-download.service';
import { OrchestratorSettingsStore } from './orchestrator-settings-store';
import type {
  AutomationAiProviderResponseDto,
  CreateAutomationAiProviderDto,
  CreateAutomationAiProviderModelDto,
  UpdateAutomationAiProviderDto,
  UpdateAutomationAiProviderModelDto,
} from './dto/automation-ai-provider.dto';
import type { AutomationAiProviderHealthDto } from './dto/automation-ai-provider-health.dto';

const providerResponse = (
  provider: AutomationAiProvider,
): AutomationAiProviderResponseDto => {
  const billingIssue = isOfficialOpenAiProvider(provider)
    ? getOpenAiBillingIssue(provider)
    : undefined;
  return {
    ...maskProvider(provider),
    ...(billingIssue && { billingIssue }),
  };
};

@Injectable()
export class AiProviderSettingsService {
  constructor(
    private readonly store: OrchestratorSettingsStore,
    private readonly aiProviderHealth: AiProviderHealthService,
    private readonly aiProviderModelDownloads: AiProviderModelDownloadService,
  ) {}

  async listProviders() {
    const settings = await this.store.getStoredSettings();
    return settings.aiProviders.map(providerResponse);
  }

  async listEnabledModelCatalog() {
    const settings = await this.store.getStoredSettings();
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
    const settings = await this.store.getStoredSettings();
    const providers = settings.aiProviders.filter(
      (provider) => provider.enabled,
    );
    const provider = providerId
      ? providers.find((item) => item.id === providerId)
      : providers.find((item) =>
          item.models.some(
            (model) => model.enabled && model.roles.includes(role),
          ),
        );
    if (!provider) {
      throw new BadRequestException(
        providerId || providers.length === 0
          ? 'No enabled AI provider is configured for automations.'
          : `No enabled ${role} AI model is configured.`,
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
    const provider = requireAiProvider(
      await this.store.getStoredSettings(),
      providerId,
    );
    return this.aiProviderHealth.checkProviderHealth(provider, modelId, role);
  }

  async checkCandidateHealth(dto: CreateAutomationAiProviderDto) {
    const provider = normalizeAiProvider({
      ...dto,
      enabled: true,
      models: dto.models ?? [],
    });
    return this.aiProviderHealth.checkProviderConnection(provider, true);
  }

  async listRemoteModels(providerId: string) {
    const provider = requireAiProvider(
      await this.store.getStoredSettings(),
      providerId,
    );
    try {
      return await this.aiProviderHealth.listRemoteModels(provider);
    } catch (error) {
      throw new BadRequestException(aiProviderErrorMessage(error));
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
        aiProviders: [...settings.aiProviders, provider],
      };
    });
    return providerResponse(provider);
  }

  async updateProvider(providerId: string, dto: UpdateAutomationAiProviderDto) {
    const settings = await this.store.updateSettings((current) =>
      replaceAiProvider(current, providerId, (provider) =>
        normalizeAiProvider(
          {
            ...provider,
            ...dto,
            id: dto.id ?? provider.id,
            apiKey: resolveUpdatedApiKey(provider.apiKey, dto.apiKey),
            models: dto.models ?? provider.models,
          },
          provider,
        ),
      ),
    );
    return providerResponse(
      requireAiProvider(settings, text(dto.id) || providerId),
    );
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
    const updatedModels = await this.updateProviderModels(
      providerId,
      (models) => {
        if (models.some((model) => model.id === dto.id.trim())) {
          throw new BadRequestException(
            `AI model "${dto.id}" already exists for provider "${providerId}".`,
          );
        }
        return [...models, normalizeAiModel(dto)];
      },
    );
    return updatedModels.find((model) => model.id === dto.id.trim());
  }

  async updateProviderModel(
    providerId: string,
    modelId: string,
    dto: UpdateAutomationAiProviderModelDto,
  ) {
    const updatedModels = await this.updateProviderModels(
      providerId,
      (models) => {
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
      },
    );
    const nextId = dto.id?.trim() || modelId;
    return updatedModels.find((model) => model.id === nextId);
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

  listActiveProviderModelDownloads(providerId: string) {
    return this.aiProviderModelDownloads.listActive(providerId);
  }

  getProviderModelDownload(providerId: string, downloadId: string) {
    return this.aiProviderModelDownloads.get(providerId, downloadId);
  }

  private async updateProviderModels(
    providerId: string,
    update: (
      models: AutomationAiProviderModel[],
    ) => AutomationAiProviderModel[],
  ) {
    const settings = await this.store.updateSettings((current) =>
      replaceAiProvider(current, providerId, (provider) => ({
        ...provider,
        models: normalizeDefaultModel(update(provider.models)),
      })),
    );
    return requireAiProvider(settings, providerId).models;
  }
}
