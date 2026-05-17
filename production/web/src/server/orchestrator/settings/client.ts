import { request } from '../request'
import type { CleanupUploadedApksResponse, OrchestratorSettingsResponse } from './types'
import type { RuntimeUiSettings } from '@/lib/orchestrator/ui-settings'

export const orchestratorSettingsClient = {
  cleanupUploadedApks(ownerUserId?: string) {
    return request<CleanupUploadedApksResponse>('/apks/cleanup', {
      method: 'POST',
      body: JSON.stringify({ ownerUserId })
    })
  },

  getSettings() {
    return request<OrchestratorSettingsResponse>('/settings')
  },

  updateSettings(input: RuntimeUiSettings) {
    return request<OrchestratorSettingsResponse>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(input)
    })
  },

  resetSettings() {
    return request<OrchestratorSettingsResponse>('/settings/reset', { method: 'POST' })
  }
}
