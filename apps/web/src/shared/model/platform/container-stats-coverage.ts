import type { SystemResources } from '@/shared/contracts/system-resources'

export const getContainerStatsCoverage = (resources?: SystemResources) => {
  const sampled = resources?.containerStatsSampled
  if (!resources || sampled === undefined || sampled >= resources.containersRunning) return null
  return {
    label: `Sampled ${sampled} of ${resources.containersRunning} running containers`,
    unavailable: sampled === 0
  }
}
