import { request } from '../request'
import type { DockerPruneAllResponse, DockerPruneResponse } from './types'

export const orchestratorDockerMaintenanceClient = {
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
  }
}
