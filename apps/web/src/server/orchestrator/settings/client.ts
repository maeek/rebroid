import { emptyRequest, jsonRequest } from '../request'
import type {
  AutomationAiModelCatalogProvider,
  AutomationAiProvider,
  AutomationAiProviderHealth,
  AutomationAiProviderModel,
  AutomationAiProviderModelDownload,
  AutomationAiProviderRemoteModel
} from '@/shared/contracts/ai-provider'
import type { CleanupUploadedApksResponse } from '@/shared/contracts/application'
import type { FeatureFlagManifest, UpdateFeatureFlags } from '@/shared/contracts/feature-flags'
import type { OrchestratorSettingsResponse } from '@/shared/contracts/ui-settings'
import type { RuntimeUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export const orchestratorSettingsClient = {
  cleanupUploadedApks(ownerUserId?: string) {
    return jsonRequest<CleanupUploadedApksResponse>('/apk-uploads/cleanup', 'POST', { ownerUserId })
  },

  getSettings() {
    return emptyRequest<OrchestratorSettingsResponse>('/settings')
  },

  updateSettings(input: RuntimeUiSettings) {
    return jsonRequest<OrchestratorSettingsResponse>('/settings', 'PATCH', input)
  },

  resetSettings() {
    return emptyRequest<OrchestratorSettingsResponse>('/settings/reset', { method: 'POST' })
  },

  getFeatures() {
    return emptyRequest<FeatureFlagManifest>('/features')
  },

  updateFeatures(input: UpdateFeatureFlags) {
    return jsonRequest<FeatureFlagManifest>('/features', 'PATCH', input)
  },

  listAiProviders() {
    return emptyRequest<AutomationAiProvider[]>('/settings/ai-providers')
  },

  createAiProvider(input: AutomationAiProvider) {
    return jsonRequest<AutomationAiProvider>('/settings/ai-providers', 'POST', input)
  },

  checkAiProviderCandidateHealth(input: AutomationAiProvider) {
    return jsonRequest<AutomationAiProviderHealth>('/settings/ai-providers/health', 'POST', input)
  },

  updateAiProvider(providerId: string, input: Partial<AutomationAiProvider>) {
    return jsonRequest<AutomationAiProvider>(`/settings/ai-providers/${encodeURIComponent(providerId)}`, 'PATCH', input)
  },

  deleteAiProvider(providerId: string) {
    return emptyRequest<void>(`/settings/ai-providers/${encodeURIComponent(providerId)}`, { method: 'DELETE' })
  },

  checkAiProviderHealth(providerId: string, modelId?: string, role?: 'controller' | 'planner' | 'vision') {
    const params = new URLSearchParams()
    if (modelId) params.set('modelId', modelId)
    if (role) params.set('role', role)
    const query = params.size > 0 ? `?${params.toString()}` : ''
    return emptyRequest<AutomationAiProviderHealth>(
      `/settings/ai-providers/${encodeURIComponent(providerId)}/health${query}`
    )
  },

  listAiProviderRemoteModels(providerId: string) {
    return emptyRequest<AutomationAiProviderRemoteModel[]>(
      `/settings/ai-providers/${encodeURIComponent(providerId)}/remote-models`
    )
  },

  createAiProviderModel(providerId: string, input: AutomationAiProviderModel) {
    return jsonRequest<AutomationAiProviderModel>(
      `/settings/ai-providers/${encodeURIComponent(providerId)}/models`,
      'POST',
      input
    )
  },

  downloadAiProviderModel(providerId: string, input: { modelId: string; label?: string }) {
    return jsonRequest<AutomationAiProviderModelDownload>(
      `/settings/ai-providers/${encodeURIComponent(providerId)}/models/download`,
      'POST',
      input
    )
  },

  getAiProviderModelDownload(providerId: string, downloadId: string) {
    return emptyRequest<AutomationAiProviderModelDownload>(
      `/settings/ai-providers/${encodeURIComponent(providerId)}/models/downloads/${encodeURIComponent(downloadId)}`
    )
  },

  updateAiProviderModel(providerId: string, modelId: string, input: Partial<AutomationAiProviderModel>) {
    return jsonRequest<AutomationAiProviderModel>(
      `/settings/ai-providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}`,
      'PATCH',
      input
    )
  },

  deleteAiProviderModel(providerId: string, modelId: string) {
    return emptyRequest<void>(
      `/settings/ai-providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}`,
      { method: 'DELETE' }
    )
  },

  listAiModelCatalog() {
    return emptyRequest<AutomationAiModelCatalogProvider[]>('/settings/ai-model-catalog')
  }
}
