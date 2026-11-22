'use client'

import { useEffect, useRef } from 'react'
import { Notice } from '@/components/ui/notice'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { formatDateLocale } from '@/lib/format'
import { managedContainerStats } from '@/shared/model/platform/managed-container-stats'
import { useSystemResources } from '@/shared/model/platform/use-system-resources'
import { QuickGlanceCard } from '@/shared/ui/settings/quick-glance-card'

export const PlatformQuickGlanceSection = ({
  refreshKey = 0,
  onRefreshComplete
}: {
  refreshKey?: number
  onRefreshComplete?: (succeeded: boolean) => void
}) => {
  const { data: resources, error: caughtError, mutate: refresh } = useSystemResources()
  const lastRefreshKey = useRef(0)
  const error = caughtError ? getDisplayErrorMessage(caughtError, 'Could not load orchestrator resources.') : null

  useEffect(() => {
    if (refreshKey > 0 && refreshKey !== lastRefreshKey.current) {
      lastRefreshKey.current = refreshKey
      void refresh(undefined, { throwOnError: true }).then(
        () => onRefreshComplete?.(true),
        () => onRefreshComplete?.(false)
      )
    }
  }, [onRefreshComplete, refresh, refreshKey])

  return (
    <PlatformCapacityContent
      resources={resources}
      error={error}
      loading={!resources && !error}
    />
  )
}

export const PlatformCapacityContent = ({
  resources,
  error = null,
  loading = false
}: {
  resources?: import('@/shared/contracts/system-resources').SystemResources
  error?: string | null
  loading?: boolean
}) => {
  if (error && !resources) {
    return (
      <Notice
        tone='warning'
        title='Capacity unavailable'
        description={error}
      />
    )
  }

  const stats = managedContainerStats(resources)

  return (
    <>
      {error ? (
        <Notice
          tone='warning'
          title='Capacity could not be refreshed'
          description={error}
        >
          <p>Showing the last collected values. Refresh Overview to try again.</p>
        </Notice>
      ) : null}
      <div className='grid grid-cols-3 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1'>
        <QuickGlanceCard
          loading={loading}
          label='Managed container CPU'
          value={stats.cpu}
          hint={stats.cpuHint}
          tone='primary'
        />
        <QuickGlanceCard
          loading={loading}
          label='Managed container memory'
          value={stats.memory}
          hint={stats.memoryHint}
          tone='primary'
        />
        <QuickGlanceCard
          loading={loading}
          label='Containers'
          value={resources ? `${resources.containersRunning}/${resources.containersTotal}` : 'Loading...'}
          hint='Running / Total'
          tone='primary'
        />
      </div>
      <div className='text-xs text-foreground-muted'>
        {stats.coverage ? `${stats.coverage}.` : 'Container stats refresh on demand and may reuse a recent sample.'}
        {resources?.containerStatsCollectedAt
          ? ` Last sample: ${formatDateLocale(resources.containerStatsCollectedAt)}`
          : ''}
      </div>
    </>
  )
}
