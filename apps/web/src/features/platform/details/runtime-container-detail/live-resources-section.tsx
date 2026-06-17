'use client'

import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import {
  useContainerDetailContext,
  useContainerDetailControllerContext
} from '@/features/platform/details/runtime-container-detail/container-detail-context'
import {
  formatByteStatsValue,
  formatCpuStatsValue,
  formatStatsSample,
  getCpuStatsHint,
  getMemoryStatsHint,
  getRefreshIcon,
  isStatsRefreshDisabled
} from '@/features/platform/details/runtime-container-detail/container-detail-utils'
import { QuickGlanceCard } from '@/shared/ui/settings/quick-glance-card'

export const LiveResourcesSection = () => {
  const { details } = useContainerDetailContext()
  const { isRefreshingStats, refreshStats, stats, statsError } = useContainerDetailControllerContext()
  const containerState = details.container.state

  return (
    <Section
      boxed
      contentClassName='gap-4'
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h3 className='font-medium'>Live resources</h3>
          <p className='mt-1 text-sm text-foreground-muted'>Docker stats sampled for this container.</p>
        </div>
        <Button
          type='button'
          variant='secondary'
          size='sm'
          disabled={isStatsRefreshDisabled(containerState, isRefreshingStats)}
          onClick={() => void refreshStats()}
        >
          {getRefreshIcon(isRefreshingStats)}
          Refresh
        </Button>
      </div>
      <Visible when={statsError}>
        <div className='rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive'>
          {statsError}
        </div>
      </Visible>
      <div className='grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1'>
        <QuickGlanceCard
          label='CPU'
          value={formatCpuStatsValue(stats)}
          hint={getCpuStatsHint(containerState)}
        />
        <QuickGlanceCard
          label='Memory'
          value={formatByteStatsValue(stats?.memoryUsageBytes)}
          hint={getMemoryStatsHint(stats)}
        />
        <QuickGlanceCard
          label='Network received'
          value={formatByteStatsValue(stats?.networkRxBytes)}
          hint='Summed across container interfaces'
        />
        <QuickGlanceCard
          label='Network transmitted'
          value={formatByteStatsValue(stats?.networkTxBytes)}
          hint='Summed across container interfaces'
        />
      </div>
      <div className='text-xs text-foreground-muted'>{formatStatsSample(containerState, stats)}</div>
    </Section>
  )
}
