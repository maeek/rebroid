'use client'

import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { SystemChart } from './chart'
import { MemoryChart } from './memory-chart'
import type { SystemStats } from '@/shared/contracts/system-stats'

export const SystemResourceCharts = ({
  stats,
  loading = false
}: {
  stats?: Pick<SystemStats, 'totalMemoryBytes' | 'freeMemoryBytes' | 'cpuUsagePercentLast50Entrires'>
  loading?: boolean
}) => (
  <div className='grid min-w-0 gap-6 xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]'>
    <Section
      title='Host memory'
      surface='panel'
      headingSpacing='default'
      className='h-full min-w-0'
      contentClassName='flex-1 justify-center'
    >
      {loading ? (
        <Skeleton className='mx-auto aspect-square w-full max-w-85 rounded-full' />
      ) : (
        <MemoryChart
          totalMemory={stats?.totalMemoryBytes ?? 0}
          freeMemory={stats?.freeMemoryBytes ?? 0}
        />
      )}
    </Section>
    <Section
      title='Host CPU history'
      surface='panel'
      headingSpacing='default'
      className='h-full min-w-0'
    >
      <div className='h-160 w-full max-lg:h-96'>
        {loading ? <Skeleton className='size-full' /> : <SystemChart cpuData={stats?.cpuUsagePercentLast50Entrires} />}
      </div>
    </Section>
  </div>
)
