import type { SystemResources } from './types'
import type { ResourceQuota } from '@/shared/permissions/permissions'

export type ResourceLimitBounds = {
  maxMemoryMb: number | null
  maxCpuCpus: number | null
  maxVolumeSizeMb: number | null
}

const bytesToWholeMb = (bytes: number | null | undefined) =>
  typeof bytes === 'number' && Number.isFinite(bytes) && bytes > 0 ? Math.floor(bytes / 1024 / 1024) : null

const boundedMax = (quotaMax: number | null, resourceMax: number | null) => {
  if (quotaMax === null) {
    return resourceMax
  }

  if (resourceMax === null) {
    return quotaMax
  }

  return Math.min(quotaMax, resourceMax)
}

export const buildResourceLimitBounds = (
  resources: Pick<SystemResources, 'dockerRootAvailableBytes' | 'hostCpuCores' | 'hostMemoryBytes'> | null,
  quotas: ResourceQuota
): ResourceLimitBounds => ({
  maxMemoryMb: boundedMax(quotas.maxMemoryMb, bytesToWholeMb(resources?.hostMemoryBytes)),
  maxCpuCpus: boundedMax(quotas.maxCpuCpus, resources?.hostCpuCores ?? null),
  maxVolumeSizeMb: boundedMax(quotas.maxVolumeSizeMb, bytesToWholeMb(resources?.dockerRootAvailableBytes))
})
