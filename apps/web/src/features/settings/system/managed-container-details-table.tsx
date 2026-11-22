'use client'

import { formatDateLocale } from '@/lib/format'
import { managedContainerStats } from '@/shared/model/platform/managed-container-stats'
import { DetailFields } from '@/shared/ui/detail-fields'
import type { SystemResources } from '@/shared/contracts/system-resources'

export function ManagedContainerDetailsTable({
  resources,
  loading = false
}: {
  resources?: SystemResources
  loading?: boolean
}) {
  if (!resources && !loading) return null
  const stats = managedContainerStats(resources)

  return (
    <DetailFields
      loading={loading}
      fields={[
        {
          label: 'CPU usage',
          value: stats.cpu
        },
        {
          label: 'Memory usage',
          value: stats.memory
        },
        {
          label: 'Last sample',
          value: resources?.containerStatsCollectedAt
            ? formatDateLocale(resources.containerStatsCollectedAt)
            : 'Unavailable',
          fullWidth: true
        },
        ...(stats.coverage ? [{ label: 'Sample coverage', value: stats.coverage, fullWidth: true }] : [])
      ]}
    />
  )
}
