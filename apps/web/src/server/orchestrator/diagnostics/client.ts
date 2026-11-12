import { emptyRequest, request } from '../request'
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

  async displaySidecarHealth() {
    return withoutEmbeddedLogs(await request<ServiceHealth>('/platform/display-sidecar/health'))
  },

  async repairDisplaySidecar() {
    return withoutEmbeddedLogs(
      await request<ServiceHealth>('/platform/display-sidecar/repair', { method: 'POST', timeoutMs: 90_000 })
    )
  },

  listDisplaySidecarSessions(signal?: AbortSignal) {
    return emptyRequest<DisplaySidecarSession[]>('/platform/display-sidecar/sessions', { signal })
  },

  releaseDisplaySidecarSession(id: string, signal?: AbortSignal) {
    return emptyRequest<DisplaySidecarSession>(`/platform/display-sidecar/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      signal
    })
  },

  getSystemResources() {
    return emptyRequest<SystemResources>('/platform/system-resources')
  },

  getSystemResourceCapacity() {
    return emptyRequest<SystemResourceCapacity>('/platform/system-resources/capacity')
  }
}
