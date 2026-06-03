import { emptyRequest, jsonRequest } from '../request'
import type { ApplicationCommandResult, SwitchApplicationProfileInput } from './types'

export const orchestratorAppLifecycleClient = {
  switchProfile(id: string, input: SwitchApplicationProfileInput) {
    return jsonRequest<ApplicationCommandResult>(`/apps/${id}/lifecycle/profile`, 'POST', input)
  },

  startApplication(id: string, input?: SwitchApplicationProfileInput) {
    return jsonRequest<ApplicationCommandResult>(`/apps/${id}/lifecycle/start`, 'POST', input ?? {})
  },

  stopApplication(id: string) {
    return emptyRequest<ApplicationCommandResult>(`/apps/${id}/lifecycle/stop`, { method: 'POST' })
  },

  updateApk(id: string, uploadedApkId: string) {
    return jsonRequest<ApplicationCommandResult>(`/apps/${id}/lifecycle/apk`, 'PUT', { uploadedApkId })
  }
}
