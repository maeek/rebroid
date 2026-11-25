'use client'

import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import { useContainerDetailContext } from '@/features/platform/details/runtime-container-detail/container-detail-context'
import {
  containerStatsRefreshIntervalMs,
  formatByteStatsValue,
  formatCpuStatsValue,
  formatStatsSample,
  getCpuStatsHint,
  getMemoryStatsHint,
  getRefreshIcon,
  isStatsRefreshDisabled
} from '@/features/platform/details/runtime-container-detail/container-detail-utils'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { getPlatformContainerStatsAction } from '@/server/orchestrator/platform/container-actions'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'
import { QuickGlanceCard } from '@/shared/ui/settings/quick-glance-card'
import type { PlatformContainerStats } from '@/shared/contracts/platform'

export const LiveResourcesSection = () => {
  const { container } = useContainerDetailContext()
  const containerState = container.state
  const {
    data: stats,
    error,
    isValidating: isRefreshingStats,
    mutate: refreshStats
  } = usePollingQuery<PlatformContainerStats>(
    ['orchestrator', 'containers', container.id, 'stats'],
    () => getPlatformContainerStatsAction(container.id),
    { enabled: containerState === 'running', intervalMs: containerStatsRefreshIntervalMs }
  )
  const statsError = error ? getDisplayErrorMessage(error, 'Could not collect live container stats.') : null

  return (
    <PlatformResourceSection
      surface='plain'
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
        <div className='rounded-panel border border-danger/(--feedback-border-opacity) bg-danger/10 p-3 text-sm text-danger'>
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
    </PlatformResourceSection>
  )
}
