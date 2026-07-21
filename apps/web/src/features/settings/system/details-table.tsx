'use client'

import type { SystemStats } from '@/shared/contracts/system-stats'

export function DetailsTable({
  systemUtilization
}: {
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
  if (!systemUtilization) return null

  return (
    <ul className='divide-y divide-border'>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-medium'>Platform:</span> {systemUtilization.platform}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-medium'>Architecture:</span> {systemUtilization.architecture}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-medium'>CPU:</span> {systemUtilization.cpu}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-medium'>CPU Cores:</span> {systemUtilization.cpuCores}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-medium'>CPU Usage:</span> {systemUtilization.cpuUsage}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-medium'>Total Memory:</span> {systemUtilization.totalMemory}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-medium'>Free Memory:</span> {systemUtilization.freeMemory}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-medium'>Memory Usage:</span> {systemUtilization.memoryUsage}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-medium'>Uptime:</span> {systemUtilization.uptime}
      </li>
    </ul>
  )
}
