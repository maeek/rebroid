import { emptyRequest } from '../request'
import type {
  DisplaySidecarSession,
  OrchestratorHealth,
  DockerMetricsSnapshot,
  ServiceHealth
} from '@/shared/contracts/diagnostics'
import type { SystemResourceCapacity, SystemResources } from '@/shared/contracts/system-resources'

export const orchestratorDiagnosticsClient = {
  health() {
    return emptyRequest<OrchestratorHealth>('/diagnostics')
  },

  healthSummary() {
    return emptyRequest<OrchestratorHealth>('/diagnostics/summary')
  },

  dockerMetrics() {
    return emptyRequest<DockerMetricsSnapshot>('/metrics/docker')
  },

  repairDisplaySidecar() {
    return emptyRequest<ServiceHealth>('/platform/display-sidecar/repair', { method: 'POST' })
  },

  listDisplaySidecarSessions() {
    return emptyRequest<DisplaySidecarSession[]>('/platform/display-sidecar/sessions')
  },

  releaseDisplaySidecarSession(id: string) {
    return emptyRequest<DisplaySidecarSession>(`/platform/display-sidecar/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
  },

  getSystemResources() {
    return emptyRequest<SystemResources>('/platform/system-resources')
  },

  getSystemResourceCapacity() {
    return emptyRequest<SystemResourceCapacity>('/platform/system-resources/capacity')
  }
}
