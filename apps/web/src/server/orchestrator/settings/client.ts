import { emptyRequest, jsonRequest } from '../request'
import type { CleanupUploadedApksResponse, OrchestratorSettingsResponse } from './types'
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
  }
}
