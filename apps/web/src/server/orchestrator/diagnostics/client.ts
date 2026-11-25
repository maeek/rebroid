import { emptyRequest, request } from '../request'
import type {
  DisplaySidecarSession,
  OrchestratorHealth,
  DockerMetricsSnapshot,
  ServiceHealth
} from '@/shared/contracts/diagnostics'
import type { SystemResourceCapacity, SystemResources } from '@/shared/contracts/system-resources'

const externalViewerSessions = '/devices/external/viewer-sessions'

const withoutEmbeddedLogs = (health: ServiceHealth): ServiceHealth => {
  if (!health.details || !('recentLogs' in health.details)) return health
  const details = { ...health.details }
  delete details.recentLogs
  return { ...health, details }
}

export const orchestratorDiagnosticsClient = {
  healthSummary(signal?: AbortSignal) {
    return emptyRequest<OrchestratorHealth>('/diagnostics/summary', { signal })
  },

  dockerMetrics() {
    return emptyRequest<DockerMetricsSnapshot>('/metrics/docker')
  },

  async displaySidecarHealth() {
    return withoutEmbeddedLogs(await request<ServiceHealth>('/platform/display-sidecar/health'))
  },

  async repairDisplaySidecar() {
    return withoutEmbeddedLogs(
      await request<ServiceHealth>('/platform/display-sidecar/repair', { method: 'POST', timeoutMs: 90_000 })
    )
  },

  listDisplaySidecarSessions(provider: 'managed' | 'external' = 'managed') {
    const path = provider === 'external' ? externalViewerSessions : '/platform/display-sidecar/sessions'
    return emptyRequest<DisplaySidecarSession[]>(path)
  },

  releaseDisplaySidecarSession(id: string, signal?: AbortSignal, external = false) {
    const path = external ? externalViewerSessions : '/platform/display-sidecar/sessions'
    return emptyRequest<DisplaySidecarSession>(`${path}/${encodeURIComponent(id)}`, {
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
