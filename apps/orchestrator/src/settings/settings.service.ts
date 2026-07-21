import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import type { BufferedUploadFile } from '../common/http-upload';
import type { AutomationAiProviderModelRole } from './contracts/ai-provider';
import { AiProviderSettingsService } from './ai-provider-settings.service';
import { OrchestratorSettingsDto } from './dto/orchestrator-settings.dto';
import { OrchestratorSettingsStore } from './orchestrator-settings-store';
import { UpdateOrchestratorSettingsDto } from './dto/update-orchestrator-settings.dto';
import type {
  CreateAutomationAiProviderDto,
  CreateAutomationAiProviderModelDto,
  UpdateAutomationAiProviderDto,
  UpdateAutomationAiProviderModelDto,
} from './dto/automation-ai-provider.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly store: OrchestratorSettingsStore,
    private readonly aiProviders: AiProviderSettingsService,
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
    const updated = await this.store.updateSettings((current) => {
      const next = this.store.normalizeSettings({ ...current, ...dto });
      return next;
    });
    return this.store.toPublicSettings(updated);
  }

  /**
   * Restores settings to config-backed defaults and overwrites the stored file.
   */
  async resetSettings() {
    const defaults = this.store.defaults();
    const updated = await this.store.updateSettings((current) => ({
      ...defaults,
      featureFlags: current.featureFlags,
    }));
    return this.store.toPublicSettings(updated);
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

  listAiProviders() {
    return this.aiProviders.listProviders();
  }

  listEnabledAiModelCatalog() {
    return this.aiProviders.listEnabledModelCatalog();
  }

  getAiProviderForExecution(
    providerId?: string,
    modelId?: string,
    role: AutomationAiProviderModelRole = 'controller',
  ) {
    return this.aiProviders.getProviderForExecution(providerId, modelId, role);
  }

  checkAiProviderHealth(
    providerId: string,
    modelId?: string,
    role?: AutomationAiProviderModelRole,
  ) {
    return this.aiProviders.checkProviderHealth(providerId, modelId, role);
  }

  checkAiProviderCandidateHealth(dto: CreateAutomationAiProviderDto) {
    return this.aiProviders.checkCandidateHealth(dto);
  }

  listAiProviderRemoteModels(providerId: string) {
    return this.aiProviders.listRemoteModels(providerId);
  }

  createAiProvider(dto: CreateAutomationAiProviderDto) {
    return this.aiProviders.createProvider(dto);
  }

  updateAiProvider(providerId: string, dto: UpdateAutomationAiProviderDto) {
    return this.aiProviders.updateProvider(providerId, dto);
  }

  deleteAiProvider(providerId: string) {
    return this.aiProviders.deleteProvider(providerId);
  }

  createAiProviderModel(
    providerId: string,
    dto: CreateAutomationAiProviderModelDto,
  ) {
    return this.aiProviders.createProviderModel(providerId, dto);
  }

  updateAiProviderModel(
    providerId: string,
    modelId: string,
    dto: UpdateAutomationAiProviderModelDto,
  ) {
    return this.aiProviders.updateProviderModel(providerId, modelId, dto);
  }

  deleteAiProviderModel(providerId: string, modelId: string) {
    return this.aiProviders.deleteProviderModel(providerId, modelId);
  }

  downloadAiProviderModel(providerId: string, modelId: string, label?: string) {
    return this.aiProviders.downloadProviderModel(providerId, modelId, label);
  }

  getAiProviderModelDownload(providerId: string, downloadId: string) {
    return this.aiProviders.getProviderModelDownload(providerId, downloadId);
  }
}
