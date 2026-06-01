import { request } from '../request'
import type {
  DisplaySidecarSession,
  OrchestratorHealth,
  ServiceHealth,
  SystemResourceCapacity,
  SystemResources
} from './types'

export const orchestratorDiagnosticsClient = {
  health() {
    return request<OrchestratorHealth>('/diagnostics')
  },

  repairDisplaySidecar() {
    return request<ServiceHealth>('/docker/sidecar/repair', { method: 'POST' })
  },

  listDisplaySidecarSessions() {
    return request<DisplaySidecarSession[]>('/docker/sidecar/sessions')
  },

  releaseDisplaySidecarSession(id: string) {
    return request<DisplaySidecarSession>(`/docker/sidecar/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  getSystemResources(refreshVolumes = false) {
    const query = new URLSearchParams({ refreshVolumes: String(refreshVolumes) })
    return request<SystemResources>(`/system-resources?${query.toString()}`)
  },

  getSystemResourceCapacity() {
    return request<SystemResourceCapacity>('/system-resources/capacity')
  }
}
