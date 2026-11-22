import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-contracts'

export type SystemResourceCapacity = OrchestratorApiSchemas['SystemResourceCapacityDto']

export interface ResourceLimitBounds extends SystemResourceCapacity {
  maxMemoryMb: number | null
  maxCpuCpus: number | null
}

export type SystemResources = Omit<OrchestratorApiSchemas['SystemResourcesDto'], 'containerStatsSampled'> & {
  containerStatsSampled?: number
}
