import { emptyRequest, jsonRequest } from '../request'
import { openAppQuotaHeaders, throwOpenAppQuotaError } from './open-app-quota'
import type { ApplicationCommandResult, SwitchApplicationProfileInput } from '@/shared/contracts/application'

export const orchestratorAppLifecycleClient = {
  switchProfile(id: string, input: SwitchApplicationProfileInput) {
    return jsonRequest<ApplicationCommandResult>(`/apps/${id}/lifecycle/profile`, 'POST', input)
  },

  deleteSavedProfile(id: string, profileName: string) {
    return emptyRequest<ApplicationCommandResult>(`/apps/${id}/lifecycle/profiles/${encodeURIComponent(profileName)}`, {
      method: 'DELETE'
    })
  },

  startApplication(id: string, input: SwitchApplicationProfileInput | undefined, maxOpenApps: number | null) {
    return jsonRequest<ApplicationCommandResult>(`/apps/${id}/lifecycle/start`, 'POST', input ?? {}, {
      headers: openAppQuotaHeaders(maxOpenApps)
    }).catch(throwOpenAppQuotaError)
  },

  stopApplication(id: string) {
    return emptyRequest<ApplicationCommandResult>(`/apps/${id}/lifecycle/stop`, { method: 'POST' })
  },

  recreateApplication(id: string, maxOpenApps: number | null) {
    return emptyRequest<ApplicationCommandResult>(`/apps/${id}/lifecycle/recreate`, {
      method: 'POST',
      headers: openAppQuotaHeaders(maxOpenApps)
    }).catch(throwOpenAppQuotaError)
  },

  updateApk(id: string, uploadedApkId: string) {
    return jsonRequest<ApplicationCommandResult>(`/apps/${id}/lifecycle/apk`, 'PUT', { uploadedApkId })
  }
}
