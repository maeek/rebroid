import {
  AndroidApplication,
  AndroidNotification,
  ApplicationLog,
  CleanupUploadedApksResponse,
  CreateAndroidApplicationInput,
  DeleteAndroidApplicationResponse,
  DockerPruneAllResponse,
  DockerPruneResponse,
  OrchestratorHealth,
  PlatformContainer,
  SwitchApplicationProfileInput,
  SystemResources,
  UploadedApk,
  UpdateNetworkPolicyInput,
  UpdateAndroidApplicationInput
} from './types'
import type { OrchestratorSettingsResponse, RuntimeUiSettings } from './ui-settings'

const defaultOrchestratorUrl = 'http://localhost:4100'
const secretHeaderName = 'x-orchestrator-secret'
const orchestratorSharedSecret = process.env.ORCHESTRATOR_SHARED_SECRET?.trim()

export const getOrchestratorBaseUrl = () =>
  process.env.ORCHESTRATOR_API_URL || process.env.NEXT_PUBLIC_ORCHESTRATOR_API_URL || defaultOrchestratorUrl

const apiUrl = (path: string) => `${getOrchestratorBaseUrl().replace(/\/$/, '')}${path}`

const getErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return fallback
  }

  const message = error.message
  if (Array.isArray(message)) {
    return message.join(', ')
  }

  return typeof message === 'string' ? message : fallback
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      ...(init?.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
      ...(orchestratorSharedSecret ? { [secretHeaderName]: orchestratorSharedSecret } : {}),
      ...init?.headers
    }
  })

  if (!response.ok) {
    const error: unknown = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(getErrorMessage(error, response.statusText))
  }

  return response.json() as Promise<T>
}

export const orchestratorApi = {
  health() {
    return request<OrchestratorHealth>('/health')
  },

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
  },

  listApplications(ownerUserId?: string) {
    const query = ownerUserId ? `?${new URLSearchParams({ ownerUserId }).toString()}` : ''
    return request<AndroidApplication[]>(`/android-applications${query}`)
  },

  getApplication(id: string) {
    return request<AndroidApplication>(`/android-applications/${id}`)
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

  getSystemResources(refreshVolumes = false) {
    const query = new URLSearchParams({ refreshVolumes: String(refreshVolumes) })
    return request<SystemResources>(`/system-resources?${query.toString()}`)
  },

  pruneImages(danglingOnly = true) {
    const query = new URLSearchParams({ danglingOnly: String(danglingOnly) })
    return request<DockerPruneResponse>(`/docker-maintenance/prune/images?${query.toString()}`, {
      method: 'POST'
    })
  },

  pruneContainers() {
    return request<DockerPruneResponse>('/docker-maintenance/prune/containers', { method: 'POST' })
  },

  pruneNetworks() {
    return request<DockerPruneResponse>('/docker-maintenance/prune/networks', { method: 'POST' })
  },

  pruneVolumes() {
    return request<DockerPruneResponse>('/docker-maintenance/prune/volumes', { method: 'POST' })
  },

  pruneAllDockerResources() {
    return request<DockerPruneAllResponse>('/docker-maintenance/prune/all', { method: 'POST' })
  },

  listPlatformContainers() {
    return request<PlatformContainer[]>('/docker-maintenance/containers')
  },

  stopPlatformContainer(id: string) {
    return request<{ id: string; stopped: boolean }>(`/docker-maintenance/containers/${id}/stop`, { method: 'POST' })
  },

  removePlatformContainer(id: string) {
    return request<{ id: string; removed: boolean }>(`/docker-maintenance/containers/${id}`, { method: 'DELETE' })
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
