import { emptyRequest, jsonRequest } from '../request'
import type {
  AutomationAiModelCatalogProvider,
  AutomationAiProvider,
  AutomationAiProviderHealth,
  AutomationAiProviderModel,
  AutomationAiProviderModelDownload,
  CleanupUploadedApksResponse,
  OrchestratorSettingsResponse
} from './types'
import type { RuntimeUiSettings } from '@/features/settings/domain/orchestrator-ui-settings'

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

  checkAiProviderHealth(providerId: string, modelId?: string) {
    const params = modelId ? `?modelId=${encodeURIComponent(modelId)}` : ''
    return emptyRequest<AutomationAiProviderHealth>(
      `/settings/ai-providers/${encodeURIComponent(providerId)}/health${params}`
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
