import { request } from '../request'
import type {
  AndroidApplication,
  AndroidNotification,
  ApplicationLog,
  CloneApplicationInput,
  CreateAndroidApplicationInput,
  DeleteAndroidApplicationResponse,
  ScrcpySession,
  SwitchApplicationProfileInput,
  UpdateAndroidApplicationInput,
  UpdateNetworkPolicyInput,
  UploadedApk
} from './types'

export const orchestratorApplicationsClient = {
  createApplication(input: CreateAndroidApplicationInput) {
    return request<AndroidApplication>('/android-applications', {
      method: 'POST',
      body: JSON.stringify(input)
    })
  },

  uploadApk(input: FormData) {
    return request<UploadedApk>('/apks', {
      method: 'POST',
      body: input
    })
  },

  listUploadedApks(ownerUserId?: string) {
    const query = ownerUserId ? `?${new URLSearchParams({ ownerUserId }).toString()}` : ''
    return request<UploadedApk[]>(`/apks${query}`)
  },

  listApplications(ownerUserId?: string) {
    const query = ownerUserId ? `?${new URLSearchParams({ ownerUserId }).toString()}` : ''
    return request<AndroidApplication[]>(`/android-applications${query}`)
  },

  getApplication(id: string) {
    return request<AndroidApplication>(`/android-applications/${id}`)
  },

  cloneApplication(id: string, input: CloneApplicationInput) {
    return request<AndroidApplication>(`/android-applications/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify(input)
    })
  },

  updateApplication(id: string, input: UpdateAndroidApplicationInput) {
    return request<AndroidApplication>(`/android-applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    })
  },

  updateNetworkPolicy(id: string, input: UpdateNetworkPolicyInput) {
    return request<AndroidApplication>(`/android-applications/${id}/network-policy`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    })
  },

  applyNetworkPolicy(id: string) {
    return request<AndroidApplication>(`/android-applications/${id}/network-policy/apply`, { method: 'POST' })
  },

  switchProfile(id: string, input: SwitchApplicationProfileInput) {
    return request<AndroidApplication>(`/android-applications/${id}/profile`, {
      method: 'POST',
      body: JSON.stringify(input)
    })
  },

  getNotifications(id: string) {
    return request<AndroidNotification[]>(`/android-applications/${id}/notifications`)
  },

  getApplicationLogs(id: string, source: 'container' | 'adb', tail = 300) {
    const query = new URLSearchParams({ tail: String(tail) })
    return request<ApplicationLog>(`/android-applications/${id}/logs/${source}?${query.toString()}`)
  },

  getScrcpySession(id: string) {
    return request<ScrcpySession>(`/android-applications/${id}/scrcpy-session`)
  },

  recordViewerActivity(id: string) {
    return request<{ id: string; lastScrcpyActivityAt: string }>(`/android-applications/${id}/viewer-activity`, {
      method: 'POST'
    })
  },

  startApplication(id: string, input?: SwitchApplicationProfileInput) {
    return request<AndroidApplication>(`/android-applications/${id}/start`, {
      method: 'POST',
      body: JSON.stringify(input ?? {})
    })
  },

  stopApplication(id: string) {
    return request<AndroidApplication>(`/android-applications/${id}/stop`, { method: 'POST' })
  },

  deleteApplication(id: string, removeData = true) {
    const query = new URLSearchParams({ removeData: String(removeData) })
    return request<DeleteAndroidApplicationResponse>(`/android-applications/${id}?${query.toString()}`, {
      method: 'DELETE'
    })
  },

  updateApk(id: string, uploadedApkId: string) {
    return request<AndroidApplication>(`/android-applications/${id}/apk`, {
      method: 'PUT',
      body: JSON.stringify({ uploadedApkId })
    })
  }
}
