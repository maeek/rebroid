import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import type { BufferedUploadFile } from '../common/http-upload';
import type { DockerOperationLimits } from '../docker/contracts/docker-operation-limits';
import type { AutomationAiProviderModelRole } from './contracts/ai-provider';
import { AiProviderSettingsService } from './ai-provider-settings.service';
import { OrchestratorSettingsDto } from './dto/orchestrator-settings.dto';
import { OrchestratorSettingsStore } from './orchestrator-settings-store';
import { UpdateOrchestratorSettingsDto } from './dto/update-orchestrator-settings.dto';
import type { AndroidRenderingSettingsDto } from './dto/android-rendering-settings.dto';
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

  async getDockerOperationLimits() {
    return (await this.store.getStoredSettings()).dockerOperationLimits;
  }

  async readAndroidRendering() {
    return (await this.store.getStoredSettings()).androidRendering;
  }

  async updateAndroidRendering(androidRendering: AndroidRenderingSettingsDto) {
    const updated = await this.store.updateSettings((current) => ({
      ...current,
      androidRendering,
    }));
    return updated.androidRendering;
  }

  async updateDockerOperationLimits(limits: DockerOperationLimits) {
    await this.store.updateSettings((current) => ({
      ...current,
      dockerOperationLimits: { ...limits },
    }));
  }

  subscribeDockerOperationLimits(
    listener: (limits: DockerOperationLimits | undefined) => void,
  ) {
    return this.store.subscribe((settings) =>
      listener(settings.dockerOperationLimits),
    );
  }

  /**
   * Merges partial updates through normalization so persisted values always stay in range.
   */
  async updateSettings(dto: UpdateOrchestratorSettingsDto) {
    const updated = await this.store.updateSettings((current) => ({
      ...current,
      ...dto,
      services: {
        ocr: dto.services?.ocr ?? current.services.ocr,
        firewall: dto.services?.firewall ?? current.services.firewall,
      },
    }));
    return this.store.toPublicSettings(updated);
  }

  async resetSettings() {
    const defaults = this.store.defaults();
    const updated = await this.store.updateSettings((current) => ({
      ...current,
      defaultContainerImage: defaults.defaultContainerImage,
      dockerImageRegistry: defaults.dockerImageRegistry,
      defaultInactivityTimeoutSeconds: defaults.defaultInactivityTimeoutSeconds,
      maxApkUploadSizeMb: defaults.maxApkUploadSizeMb,
      services: defaults.services,
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
