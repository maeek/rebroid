import { emptyRequest } from '../request'
import type {
  PlatformContainer,
  PlatformContainerDetails,
  PlatformContainerLog,
  PlatformContainerStats,
  PlatformImage,
  PlatformImageDetails,
  PlatformNetwork,
  PlatformNetworkDetails
} from './types'

export const orchestratorPlatformClient = {
  listPlatformContainers() {
    return emptyRequest<PlatformContainer[]>('/platform/docker/containers')
  },

  getPlatformContainer(id: string) {
    return emptyRequest<PlatformContainerDetails>(`/platform/docker/containers/${id}`)
  },

  getPlatformContainerLogs(id: string, tail = 500) {
    const query = new URLSearchParams({ tail: String(tail) })
    return emptyRequest<PlatformContainerLog>(`/platform/docker/containers/${id}/logs?${query.toString()}`)
  },

  getPlatformContainerStats(id: string) {
    return emptyRequest<PlatformContainerStats>(`/platform/docker/containers/${id}/stats`)
  },

  listPlatformImages() {
    return emptyRequest<PlatformImage[]>('/platform/docker/images')
  },

  getPlatformImage(id: string) {
    return emptyRequest<PlatformImageDetails>(`/platform/docker/images/${encodeURIComponent(id)}`)
  },

  removePlatformImage(id: string, force = false) {
    const query = new URLSearchParams({ force: String(force) })
    return emptyRequest<{ id: string; removed: boolean }>(
      `/platform/docker/images/${encodeURIComponent(id)}?${query.toString()}`,
      { method: 'DELETE' }
    )
  },

  listPlatformNetworks() {
    return emptyRequest<PlatformNetwork[]>('/platform/docker/networks')
  },

  getPlatformNetwork(id: string) {
    return emptyRequest<PlatformNetworkDetails>(`/platform/docker/networks/${id}`)
  },

  removePlatformNetwork(id: string) {
    return emptyRequest<{ id: string; removed: boolean }>(`/platform/docker/networks/${id}`, { method: 'DELETE' })
  },

  stopPlatformContainer(id: string) {
    return emptyRequest<{ id: string; stopped: boolean }>(`/platform/docker/containers/${id}/stop`, { method: 'POST' })
  },

  removePlatformContainer(id: string, force = false) {
    const query = new URLSearchParams({ force: String(force) })
    return emptyRequest<{ id: string; removed: boolean }>(`/platform/docker/containers/${id}?${query.toString()}`, {
      method: 'DELETE'
    })
  }
}
