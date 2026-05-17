import { request } from '../request'
import type {
  PlatformContainer,
  PlatformContainerDetails,
  PlatformContainerLog,
  PlatformImage,
  PlatformImageDetails,
  PlatformNetwork,
  PlatformNetworkDetails
} from './types'

export const orchestratorPlatformClient = {
  listPlatformContainers() {
    return request<PlatformContainer[]>('/docker-maintenance/containers')
  },

  getPlatformContainer(id: string) {
    return request<PlatformContainerDetails>(`/docker-maintenance/containers/${id}`)
  },

  getPlatformContainerLogs(id: string, tail = 500) {
    const query = new URLSearchParams({ tail: String(tail) })
    return request<PlatformContainerLog>(`/docker-maintenance/containers/${id}/logs?${query.toString()}`)
  },

  listPlatformImages() {
    return request<PlatformImage[]>('/docker-maintenance/images')
  },

  getPlatformImage(id: string) {
    return request<PlatformImageDetails>(`/docker-maintenance/images/${encodeURIComponent(id)}`)
  },

  removePlatformImage(id: string, force = false) {
    const query = new URLSearchParams({ force: String(force) })
    return request<{ id: string; removed: boolean }>(
      `/docker-maintenance/images/${encodeURIComponent(id)}?${query.toString()}`,
      { method: 'DELETE' }
    )
  },

  listPlatformNetworks() {
    return request<PlatformNetwork[]>('/docker-maintenance/networks')
  },

  getPlatformNetwork(id: string) {
    return request<PlatformNetworkDetails>(`/docker-maintenance/networks/${id}`)
  },

  removePlatformNetwork(id: string) {
    return request<{ id: string; removed: boolean }>(`/docker-maintenance/networks/${id}`, { method: 'DELETE' })
  },

  stopPlatformContainer(id: string) {
    return request<{ id: string; stopped: boolean }>(`/docker-maintenance/containers/${id}/stop`, { method: 'POST' })
  },

  removePlatformContainer(id: string) {
    return request<{ id: string; removed: boolean }>(`/docker-maintenance/containers/${id}`, { method: 'DELETE' })
  }
}
