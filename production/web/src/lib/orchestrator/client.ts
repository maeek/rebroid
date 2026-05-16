import {
  AndroidApplication,
  AndroidNotification,
  DeleteAndroidApplicationResponse,
  DockerPruneAllResponse,
  DockerPruneResponse,
  ORCHESTRATOR_OWNER_USER_ID,
  SwitchApplicationProfileInput,
  SystemResources,
  UpdateNetworkPolicyInput,
  UpdateAndroidApplicationInput
} from './types'
import type { OrchestratorSettingsResponse, RuntimeUiSettings } from './ui-settings'

const defaultOrchestratorUrl = 'http://localhost:4100'

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
  createApplication(input: FormData) {
    return request<AndroidApplication>('/android-applications', {
      method: 'POST',
      body: input
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

  listApplications(ownerUserId = ORCHESTRATOR_OWNER_USER_ID) {
    const query = new URLSearchParams({ ownerUserId })
    return request<AndroidApplication[]>(`/android-applications?${query.toString()}`)
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

  updateApk(id: string, apk: File) {
    const body = new FormData()
    body.set('apk', apk)

    return request<AndroidApplication>(`/android-applications/${id}/apk`, {
      method: 'PUT',
      body
    })
  }
}
