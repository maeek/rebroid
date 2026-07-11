export interface ResourceLimitBounds {
  maxMemoryMb: number | null
  maxCpuCpus: number | null
}

export interface SystemResourceCapacity {
  hostMemoryBytes: number | null
  hostCpuCores: number | null
}

export interface ManagedContainerUsage {
  id: string
  name: string
  state: string
  status: string
}

export interface SystemResources extends SystemResourceCapacity {
  dockerRootAvailableBytes: number | null
  containersTotal: number
  containersRunning: number
  containersStopped: number
  managedContainersCpuUsagePercent: number
  managedContainersMemoryUsageBytes: number
  containerStatsCollectedAt: string | null
  containers: ManagedContainerUsage[]
}
