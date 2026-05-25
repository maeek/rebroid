import { request } from '../request'
import type {
  AndroidApplication,
  ApplicationClipboard,
  ApplicationRuntimeFile,
  ApplicationRuntimeFileDownload,
  ApplicationRuntimeFilesProfileInput,
  ApplicationRuntimeFileUpload,
  ApplicationScreenshot,
  ApplicationViewerControlCommand,
  ApplicationViewerControlResponse,
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

  lookupUploadedApk(sha256: string, ownerUserId?: string) {
    const query = new URLSearchParams({
      sha256,
      ...(ownerUserId ? { ownerUserId } : {})
    })
    return request<UploadedApk | null>(`/apks/lookup?${query.toString()}`)
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

  getApplicationLogs(id: string, source: 'orchestrator' | 'container' | 'adb', tail = 300) {
    const query = new URLSearchParams({ tail: String(tail) })
    return request<ApplicationLog>(`/android-applications/${id}/logs/${source}?${query.toString()}`)
  },

  listDownloadFiles(id: string, input: ApplicationRuntimeFilesProfileInput = {}) {
    const query = new URLSearchParams()
    if (input.profileMode) query.set('profileMode', input.profileMode)
    if (input.profileName) query.set('profileName', input.profileName)
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return request<ApplicationRuntimeFile[]>(`/android-applications/${id}/files/downloads${suffix}`)
  },

  uploadDownloadFile(id: string, input: FormData, profile: ApplicationRuntimeFilesProfileInput = {}) {
    const query = new URLSearchParams()
    if (profile.profileMode) query.set('profileMode', profile.profileMode)
    if (profile.profileName) query.set('profileName', profile.profileName)
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return request<ApplicationRuntimeFileUpload>(`/android-applications/${id}/files/downloads${suffix}`, {
      method: 'POST',
      body: input
    })
  },

  downloadFile(id: string, fileName: string, input: ApplicationRuntimeFilesProfileInput = {}) {
    const query = new URLSearchParams()
    if (input.profileMode) query.set('profileMode', input.profileMode)
    if (input.profileName) query.set('profileName', input.profileName)
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return request<ApplicationRuntimeFileDownload>(
      `/android-applications/${id}/files/downloads/${encodeURIComponent(fileName)}${suffix}`
    )
  },

  getClipboard(id: string) {
    return request<ApplicationClipboard>(`/android-applications/${id}/clipboard`)
  },

  setClipboard(id: string, text: string) {
    return request<ApplicationClipboard>(`/android-applications/${id}/clipboard`, {
      method: 'PUT',
      body: JSON.stringify({ text })
    })
  },

  captureScreenshot(id: string) {
    return request<ApplicationScreenshot>(`/android-applications/${id}/screenshot`, {
      method: 'POST'
    })
  },

  sendViewerControl(id: string, command: ApplicationViewerControlCommand) {
    return request<ApplicationViewerControlResponse>(`/android-applications/${id}/viewer-control`, {
      method: 'POST',
      body: JSON.stringify({ command })
    })
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
