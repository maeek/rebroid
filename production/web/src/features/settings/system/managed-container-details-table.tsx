'use client'

import { formatUtcDateTime } from '@/lib/format'
import type { SystemResources } from '@/server/orchestrator/diagnostics/types'

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(2)} ${units[index]}`
}

const formatPercent = (value: number) => `${value.toFixed(1)}%`

export function ManagedContainerDetailsTable({ resources }: { resources?: SystemResources }) {
  if (!resources) return null

  return (
    <ul className='divide-y divide-border'>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-semibold'>CPU Usage:</span> {formatPercent(resources.managedContainersCpuUsagePercent)}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-semibold'>Memory Usage:</span> {formatBytes(resources.managedContainersMemoryUsageBytes)}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-semibold'>Last Sample:</span>{' '}
        {resources.containerStatsCollectedAt ? formatUtcDateTime(resources.containerStatsCollectedAt) : 'Unavailable'}
      </li>
    </ul>
  )
}
