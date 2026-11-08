'use client'

import { DetailFields } from '@/shared/ui/detail-fields'
import type { SystemStats } from '@/shared/contracts/system-stats'

export function DetailsTable({
  systemUtilization,
  loading = false
}: {
  loading?: boolean
  systemUtilization?: Pick<
    SystemStats,
    | 'platform'
    | 'architecture'
    | 'cpu'
    | 'cpuCores'
    | 'cpuUsage'
    | 'totalMemory'
    | 'freeMemory'
    | 'memoryUsage'
    | 'uptime'
  >
}) {
  if (!systemUtilization && !loading) return null

  return (
    <DetailFields
      loading={loading}
      fields={[
        { label: 'Platform', value: systemUtilization?.platform },
        { label: 'Architecture', value: systemUtilization?.architecture },
        { label: 'CPU', value: systemUtilization?.cpu, fullWidth: true },
        { label: 'CPU cores', value: systemUtilization?.cpuCores },
        { label: 'CPU usage', value: systemUtilization?.cpuUsage },
        { label: 'Total memory', value: systemUtilization?.totalMemory },
        { label: 'Free memory', value: systemUtilization?.freeMemory },
        { label: 'Memory usage', value: systemUtilization?.memoryUsage },
        { label: 'Uptime', value: systemUtilization?.uptime }
      ]}
    />
  )
}
