'use client'

import { formatDateLocale } from '@/lib/format'
import { formatBytes } from '@/lib/format-bytes'
import { getContainerStatsCoverage } from '@/shared/model/platform/container-stats-coverage'
import { DetailFields } from '@/shared/ui/detail-fields'
import type { SystemResources } from '@/shared/contracts/system-resources'

const formatPercent = (value: number) => `${value.toFixed(1)}%`

export function ManagedContainerDetailsTable({
  resources,
  loading = false
}: {
  resources?: SystemResources
  loading?: boolean
}) {
  if (!resources && !loading) return null
  const coverage = getContainerStatsCoverage(resources)

  return (
    <DetailFields
      loading={loading}
      fields={[
        {
          label: 'CPU usage',
          value: coverage?.unavailable ? 'Unavailable' : formatPercent(resources?.managedContainersCpuUsagePercent ?? 0)
        },
        {
          label: 'Memory usage',
          value: coverage?.unavailable ? 'Unavailable' : formatBytes(resources?.managedContainersMemoryUsageBytes ?? 0)
        },
        {
          label: 'Last sample',
          value: resources?.containerStatsCollectedAt
            ? formatDateLocale(resources.containerStatsCollectedAt)
            : 'Unavailable',
          fullWidth: true
        },
        ...(coverage ? [{ label: 'Sample coverage', value: coverage.label, fullWidth: true }] : [])
      ]}
    />
  )
}
