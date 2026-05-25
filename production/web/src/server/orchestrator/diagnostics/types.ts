export interface SystemResources {
  containersTotal: number
  containersRunning: number
  containersStopped: number
  managedContainersCpuUsagePercent: number
  managedContainersMemoryUsageBytes: number
  containerStatsCollectedAt: string | null
  managedVolumesTotal: number
  managedVolumesSizeBytes: number
  volumeUsageCachedAt: string | null
  containers: Array<{ id: string; name: string; state: string; status: string }>
  volumes: Array<{ name: string; sizeBytes: number | null }>
}

export interface ServiceHealth {
  ok: boolean
  status: 'healthy' | 'unhealthy' | 'offline'
  message: string
  details?: Record<string, string | number | boolean | null>
}

export interface OrchestratorHealth {
  ok: boolean
  docker: boolean
  runtime: boolean
  display: boolean
  services: {
    orchestrator: ServiceHealth
    docker: ServiceHealth
    runtime: ServiceHealth
    display: ServiceHealth
  }
}
