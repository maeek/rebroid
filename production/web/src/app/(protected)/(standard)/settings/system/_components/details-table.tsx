'use client'

import type { SystemStats } from '@/lib/system/system-stats'

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
        <span className='font-semibold'>Platform:</span> {systemUtilization.platform}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-semibold'>Architecture:</span> {systemUtilization.architecture}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-semibold'>CPU:</span> {systemUtilization.cpu}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-semibold'>CPU Cores:</span> {systemUtilization.cpuCores}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-semibold'>CPU Usage:</span> {systemUtilization.cpuUsage}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-semibold'>Total Memory:</span> {systemUtilization.totalMemory}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-semibold'>Free Memory:</span> {systemUtilization.freeMemory}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-semibold'>Memory Usage:</span> {systemUtilization.memoryUsage}
      </li>
      <li className='p-2 flex justify-between gap-2 text-right text-sm'>
        <span className='font-semibold'>Uptime:</span> {systemUtilization.uptime}
      </li>
    </ul>
  )
}
