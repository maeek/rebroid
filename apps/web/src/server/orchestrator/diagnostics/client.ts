import { request } from '../request'
import type {
  DisplaySidecarSession,
  OrchestratorHealth,
  DockerMetricsSnapshot,
  ServiceHealth,
  SystemResourceCapacity,
  SystemResources
} from './types'

export const orchestratorDiagnosticsClient = {
  health() {
    return request<OrchestratorHealth>('/diagnostics')
  },

  healthSummary() {
    return request<OrchestratorHealth>('/diagnostics/summary')
  },

  dockerMetrics() {
    return request<DockerMetricsSnapshot>('/metrics/docker')
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

  getSystemResources() {
    return request<SystemResources>('/system-resources')
  },

  getSystemResourceCapacity() {
    return request<SystemResourceCapacity>('/system-resources/capacity')
  }
}
