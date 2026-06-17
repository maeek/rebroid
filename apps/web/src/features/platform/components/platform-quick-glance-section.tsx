'use client'

import { useEffect } from 'react'
import { Visible } from '@/components/ui/visible'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { formatDateLocale } from '@/lib/format'
import { useSystemResources } from '@/shared/model/platform/use-system-resources'
import { QuickGlanceCard } from '@/shared/ui/settings/quick-glance-card'

const formatBytes = (bytes: number) => {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(2)} ${units[index]}`
}

const formatPercent = (value: number) => `${value.toFixed(1)}%`

const valueOrUnavailable = (value: string | undefined, error: string | null) => {
  if (value) {
    return value
  }

  return error ? 'Unavailable' : 'Loading...'
}

const loadingHint = (loading: string, error: string | null, errorHint: string) => {
  if (error) {
    return errorHint
  }

  return loading
}

export const PlatformQuickGlanceSection = ({
  refreshKey = 0,
  onRefreshComplete
}: {
  refreshKey?: number
  onRefreshComplete?: () => void
}) => {
  const { data: resources, error: caughtError, refresh } = useSystemResources()
  const error = caughtError ? getDisplayErrorMessage(caughtError, 'Could not load orchestrator resources.') : null

  const cpuHint = () => {
    if (!resources) {
      return loadingHint('Collecting live Docker stats', error, 'Live Docker stats could not be collected')
    }

    return resources.containersRunning > 0
      ? `Aggregated live usage across ${resources.containersRunning} running containers`
      : 'No running managed containers'
  }

  const memoryHint = () => {
    if (!resources) {
      return loadingHint('Collecting live Docker stats', error, 'Live Docker stats could not be collected')
    }

    return resources.containersRunning > 0
      ? 'Aggregated working-set memory from live Docker container stats'
      : 'No running managed containers'
  }

  useEffect(() => {
    if (refreshKey > 0) {
      void refresh().finally(() => onRefreshComplete?.())
    }
  }, [onRefreshComplete, refresh, refreshKey])

  return (
    <>
      <Visible when={error}>
        <div className='rounded-lg border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive'>
          {error}
        </div>
      </Visible>
      <div className='grid grid-cols-3 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1'>
        <QuickGlanceCard
          label='Managed container CPU'
          value={valueOrUnavailable(
            resources ? formatPercent(resources.managedContainersCpuUsagePercent) : undefined,
            error
          )}
          hint={cpuHint()}
          className='border-l-primary/50'
        />
        <QuickGlanceCard
          label='Managed container memory'
          value={valueOrUnavailable(
            resources ? formatBytes(resources.managedContainersMemoryUsageBytes) : undefined,
            error
          )}
          hint={memoryHint()}
          className='border-l-primary/50'
        />
        <QuickGlanceCard
          label='Containers'
          value={valueOrUnavailable(
            resources ? `${resources.containersRunning}/${resources.containersTotal}` : undefined,
            error
          )}
          hint='Running / Total'
          className='border-l-primary/50'
        />
      </div>
      <div className='text-xs text-foreground-muted'>
        Container stats are sampled live when this panel refreshes.
        {resources?.containerStatsCollectedAt
          ? ` Last sample: ${formatDateLocale(resources.containerStatsCollectedAt)}`
          : ''}
      </div>
    </>
  )
}
