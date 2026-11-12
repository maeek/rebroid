'use client'

import { useEffect, useRef } from 'react'
import { Notice } from '@/components/ui/notice'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { formatDateLocale } from '@/lib/format'
import { getContainerStatsCoverage } from '@/shared/model/platform/container-stats-coverage'
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

export const PlatformQuickGlanceSection = ({
  refreshKey = 0,
  onRefreshComplete
}: {
  refreshKey?: number
  onRefreshComplete?: () => void
}) => {
  const { data: resources, error: caughtError, refresh } = useSystemResources()
  const lastRefreshKey = useRef(0)
  const error = caughtError ? getDisplayErrorMessage(caughtError, 'Could not load orchestrator resources.') : null

  useEffect(() => {
    if (refreshKey > 0 && refreshKey !== lastRefreshKey.current) {
      lastRefreshKey.current = refreshKey
      void refresh().finally(() => onRefreshComplete?.())
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

  const coverage = getContainerStatsCoverage(resources)
  const sampled = resources?.containerStatsSampled ?? resources?.containersRunning ?? 0
  const cpuHint = () => {
    if (!resources) {
      return 'Collecting live Docker stats'
    }

    if (coverage?.unavailable) return 'No samples were collected'
    return sampled > 0 ? `Usage across ${sampled} sampled containers` : 'No running managed containers'
  }

  const memoryHint = () => {
    if (!resources) {
      return 'Collecting live Docker stats'
    }

    if (coverage?.unavailable) return 'No samples were collected'
    return sampled > 0 ? 'Working-set memory from sampled containers' : 'No running managed containers'
  }

  let cpuValue = resources ? formatPercent(resources.managedContainersCpuUsagePercent) : 'Loading...'
  let memoryValue = resources ? formatBytes(resources.managedContainersMemoryUsageBytes) : 'Loading...'
  if (coverage?.unavailable) {
    cpuValue = 'Unavailable'
    memoryValue = 'Unavailable'
  }

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
          value={cpuValue}
          hint={cpuHint()}
          tone='primary'
        />
        <QuickGlanceCard
          loading={loading}
          label='Managed container memory'
          value={memoryValue}
          hint={memoryHint()}
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
        {coverage ? `${coverage.label}.` : 'Container stats refresh on demand and may reuse a recent sample.'}
        {resources?.containerStatsCollectedAt
          ? ` Last sample: ${formatDateLocale(resources.containerStatsCollectedAt)}`
          : ''}
      </div>
    </>
  )
}
