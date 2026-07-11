'use client'

import { formatDateLocale } from '@/lib/format'
import { formatBytes } from '@/lib/format-bytes'
import type { SystemResources } from '@/shared/contracts/system-resources'

const formatPercent = (value: number) => `${value.toFixed(1)}%`

export function ManagedContainerDetailsTable({ resources }: { resources?: SystemResources }) {
  if (!resources) return null

  return (
    <ul className='divide-y divide-border'>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-medium'>CPU Usage:</span> {formatPercent(resources.managedContainersCpuUsagePercent)}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-medium'>Memory Usage:</span> {formatBytes(resources.managedContainersMemoryUsageBytes)}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-medium'>Last Sample:</span>{' '}
        {resources.containerStatsCollectedAt ? formatDateLocale(resources.containerStatsCollectedAt) : 'Unavailable'}
      </li>
    </ul>
  )
}
