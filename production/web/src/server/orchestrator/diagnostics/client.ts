import { request } from '../request'
import type { OrchestratorHealth, ServiceHealth, SystemResourceCapacity, SystemResources } from './types'

export const orchestratorDiagnosticsClient = {
  health() {
    return request<OrchestratorHealth>('/health')
  },

  repairDisplaySidecar() {
    return request<ServiceHealth>('/docker/sidecar/repair', { method: 'POST' })
  },

  getSystemResources(refreshVolumes = false) {
    const query = new URLSearchParams({ refreshVolumes: String(refreshVolumes) })
    return request<SystemResources>(`/system-resources?${query.toString()}`)
  },

  getSystemResourceCapacity() {
    return request<SystemResourceCapacity>('/system-resources/capacity')
  }
}
