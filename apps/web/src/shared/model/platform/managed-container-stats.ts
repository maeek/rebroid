import { formatBytes } from '@/lib/format-bytes'
import type { SystemResources } from '@/shared/contracts/system-resources'

export const managedContainerStats = (resources?: SystemResources) => {
  const running = resources?.containersRunning ?? 0
  const sampled = resources?.containerStatsSampled ?? running
  const coverage = sampled < running ? `Sampled ${sampled} of ${running} running containers` : null
  const missing = running > 0 && sampled === 0
  const usable = resources && !missing
  const placeholder = resources ? 'Unavailable' : 'Loading...'
  let hint: string | undefined
  if (!resources) hint = 'Collecting live Docker stats'
  else if (missing) hint = 'No samples were collected'
  else if (sampled === 0) hint = 'No running managed containers'
  return {
    coverage,
    cpu: usable ? `${resources.managedContainersCpuUsagePercent.toFixed(1)}%` : placeholder,
    memory: usable ? formatBytes(resources.managedContainersMemoryUsageBytes) : placeholder,
    cpuHint: hint ?? `Usage across ${sampled} sampled containers`,
    memoryHint: hint ?? 'Working-set memory from sampled containers'
  }
}
