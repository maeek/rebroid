import { request } from '../request'
import type { OrchestratorHealth, ServiceHealth, SystemResources } from './types'

export const orchestratorDiagnosticsClient = {
  health() {
    return request<OrchestratorHealth>('/health')
  },

  repairScrcpySidecar() {
    return request<ServiceHealth>('/health/scrcpy/repair', { method: 'POST' })
  },

  getSystemResources(refreshVolumes = false) {
    const query = new URLSearchParams({ refreshVolumes: String(refreshVolumes) })
    return request<SystemResources>(`/system-resources?${query.toString()}`)
  }
}
