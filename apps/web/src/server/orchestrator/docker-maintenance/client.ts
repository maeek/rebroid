import { emptyRequest } from '../request'
import type { DockerPruneAllResponse, DockerPruneResponse } from './types'

export const orchestratorDockerMaintenanceClient = {
  pruneImages(danglingOnly = true) {
    const query = new URLSearchParams({ danglingOnly: String(danglingOnly) })
    return emptyRequest<DockerPruneResponse>(`/platform/docker/prune/images?${query.toString()}`, {
      method: 'POST'
    })
  },

  pruneContainers() {
    return emptyRequest<DockerPruneResponse>('/platform/docker/prune/containers', { method: 'POST' })
  },

  pruneNetworks() {
    return emptyRequest<DockerPruneResponse>('/platform/docker/prune/networks', { method: 'POST' })
  },

  pruneVolumes() {
    return emptyRequest<DockerPruneResponse>('/platform/docker/prune/volumes', { method: 'POST' })
  },

  pruneAllDockerResources() {
    return emptyRequest<DockerPruneAllResponse>('/platform/docker/prune/all', { method: 'POST' })
  }
}
