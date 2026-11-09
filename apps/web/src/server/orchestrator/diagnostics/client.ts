import { emptyRequest } from '../request'
import type {
  DisplaySidecarLogTail,
  DisplaySidecarSession,
  OrchestratorHealth,
  DockerMetricsSnapshot,
  ServiceHealth
} from '@/shared/contracts/diagnostics'
import type { SystemResourceCapacity, SystemResources } from '@/shared/contracts/system-resources'

const withoutEmbeddedLogs = (health: ServiceHealth): ServiceHealth => {
  if (!health.details || !('recentLogs' in health.details)) return health
  const details = { ...health.details }
  delete details.recentLogs
  return { ...health, details }
}

export const orchestratorDiagnosticsClient = {
  async health() {
    const health = await emptyRequest<OrchestratorHealth>('/diagnostics')
    return { ...health, services: { ...health.services, display: withoutEmbeddedLogs(health.services.display) } }
  },

  healthSummary() {
    return emptyRequest<OrchestratorHealth>('/diagnostics/summary')
  },

  dockerMetrics() {
    return emptyRequest<DockerMetricsSnapshot>('/metrics/docker')
  },

  displaySidecarLogs(expanded: boolean) {
    return emptyRequest<DisplaySidecarLogTail>(`/platform/display-sidecar/logs?expanded=${expanded}`)
  },

  async repairDisplaySidecar() {
    return withoutEmbeddedLogs(
      await emptyRequest<ServiceHealth>('/platform/display-sidecar/repair', { method: 'POST' })
    )
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
